import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  modeNeedsHideReason,
  ORG_ROLE_LABELS,
  type AdminNetwork,
  type AdminNetworkSummary,
  type AdminStation,
  type AdminStationSummary,
  type NetworkEvent,
  type OfficialDivergence,
  type SetStationMode,
  type StationMode,
  type OrgRole,
} from '@tankei/shared';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { normalized } from '../database/normalized';
import {
  organizationEvents,
  organizationMembers,
  organizations,
  organizationStations,
  stationClaimDecisions,
  stationClaims,
  stationManagers,
  stationModeChanges,
  stations,
  users,
} from '../database/schema';
import { PriceReportsService } from '../prices/price-reports.service';
import { OrganizationsService } from '../organizations/organizations.service';
import {
  brandDisplayName,
  cityDisplayName,
  formatCnpj,
  stationDisplayName,
} from '../stations/display-name';

const SEARCH_LIMIT = 30;
const NETWORK_LIMIT = 100;
const EVENT_LIMIT = 100;

const summaryColumns = {
  id: stations.id,
  cnpj: stations.cnpj,
  legalName: stations.legalName,
  tradeName: stations.tradeName,
  brand: stations.brand,
  city: stations.city,
  state: stations.state,
  active: stations.active,
  mode: stations.displayMode,
  networkId: organizations.id,
  networkName: organizations.name,
};

type SummaryRow = {
  id: string;
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  brand: string;
  city: string;
  state: string;
  active: boolean;
  mode: StationMode;
  networkId: string | null;
  networkName: string | null;
};

function toSummary(row: SummaryRow): AdminStationSummary {
  return {
    id: row.id,
    name: stationDisplayName(row.tradeName, row.legalName),
    legalName: row.legalName,
    cnpj: formatCnpj(row.cnpj),
    brand: brandDisplayName(row.brand),
    city: cityDisplayName(row.city),
    state: row.state,
    active: row.active,
    mode: row.mode,
    network:
      row.networkId && row.networkName
        ? { id: row.networkId, name: row.networkName }
        : null,
  };
}

/** Nome, e-mail ou "conta excluída", para textos do registro. */
function personLabel(person?: { name: string | null; email: string | null }) {
  return person?.name ?? person?.email ?? 'conta excluída';
}

/**
 * Consulta de postos e redes para a equipe Tankei (ADR 0023). As alterações
 * passam pelo OrganizationsService, com as mesmas regras do portal.
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly organizations: OrganizationsService,
    private readonly prices: PriceReportsService,
  ) {}

  // ---------- Postos ----------

  /** Por CNPJ (dígitos, pode ser parcial), nome ou cidade; inclui inativos. */
  async searchStations(q: string): Promise<AdminStationSummary[]> {
    const digits = q.replace(/\D/g, '');
    const looksLikeCnpj = digits.length >= 4 && !/[a-z]/i.test(q);
    const term = normalized(`%${q}%`);
    const filter = looksLikeCnpj
      ? sql`${stations.cnpj} like ${`${digits}%`}`
      : or(
          sql`${normalized(sql`coalesce(${stations.tradeName}, '') || ' ' || ${stations.legalName}`)} like ${term}`,
          sql`${normalized(sql`${stations.city}`)} like ${term}`,
        );

    const rows = await this.stationQuery()
      .where(filter)
      .orderBy(stations.state, stations.city, stations.legalName)
      .limit(SEARCH_LIMIT);
    return rows.map(toSummary);
  }

  async station(stationId: string): Promise<AdminStation> {
    const [row] = await this.db
      .select({
        ...summaryColumns,
        address: stations.address,
        district: stations.district,
      })
      .from(stations)
      .leftJoin(
        organizationStations,
        eq(organizationStations.stationId, stations.id),
      )
      .leftJoin(
        organizations,
        eq(organizations.id, organizationStations.organizationId),
      )
      .where(eq(stations.id, stationId));
    if (!row) throw new NotFoundException('Posto não encontrado.');

    const [managers, [pending]] = await Promise.all([
      this.db
        .select({
          userId: stationManagers.userId,
          name: users.name,
          email: users.email,
          verificationMethod: stationManagers.verificationMethod,
          verifiedAt: stationManagers.verifiedAt,
        })
        .from(stationManagers)
        .innerJoin(users, eq(users.id, stationManagers.userId))
        .where(
          and(
            eq(stationManagers.stationId, stationId),
            eq(stationManagers.role, 'responsavel'),
          ),
        )
        .orderBy(stationManagers.createdAt),
      this.db
        .select({ total: count() })
        .from(stationClaims)
        .leftJoin(
          stationClaimDecisions,
          eq(stationClaimDecisions.claimId, stationClaims.id),
        )
        .where(
          and(
            eq(stationClaims.stationId, stationId),
            isNull(stationClaimDecisions.id),
          ),
        ),
    ]);

    return {
      ...toSummary(row),
      address: row.address,
      district: row.district,
      verifiedManagers: managers.map((m) => ({
        ...m,
        verifiedAt: m.verifiedAt?.toISOString() ?? null,
      })),
      pendingClaims: pending?.total ?? 0,
      modeHistory: await this.modeHistory(stationId),
    };
  }

  // ---------- Modo de exibição (ADR 0028) ----------

  /**
   * Muda o modo de exibição do posto, a pedido dele, com registro. "Preço
   * oficial" só para posto com rede (cliente).
   */
  async setStationMode(
    adminId: string,
    stationId: string,
    body: SetStationMode,
  ): Promise<AdminStation> {
    const [row] = await this.stationQuery().where(eq(stations.id, stationId));
    if (!row) throw new NotFoundException('Posto não encontrado.');
    if (row.mode === body.mode) {
      throw new BadRequestException('O posto já está neste modo.');
    }
    if (body.mode === 'preco_oficial' && !row.networkId) {
      throw new BadRequestException(
        'Preço oficial é só para posto com rede no portal (cliente).',
      );
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(stations)
        .set({ displayMode: body.mode })
        .where(eq(stations.id, stationId));
      await tx.insert(stationModeChanges).values({
        stationId,
        mode: body.mode,
        hideReason: modeNeedsHideReason(body.mode) ? body.hideReason : null,
        requestedBy: body.requestedBy,
        reason: body.reason,
        decidedByUserId: adminId,
      });
    });
    return this.station(stationId);
  }

  /**
   * Postos em "preço oficial" com divergência além do prazo: a equipe confere
   * se o posto informa preço falso e, se for o caso, tira o modo.
   */
  async officialDivergences(now = new Date()): Promise<OfficialDivergence[]> {
    const rows = await this.db
      .select({
        id: stations.id,
        tradeName: stations.tradeName,
        legalName: stations.legalName,
        city: stations.city,
        state: stations.state,
      })
      .from(stations)
      .where(eq(stations.displayMode, 'preco_oficial'));
    if (rows.length === 0) return [];
    const prices = await this.prices.currentPrices(
      rows.map((r) => r.id),
      now,
    );
    return rows.flatMap((r) =>
      (prices.get(r.id) ?? []).flatMap((p) =>
        p.divergence && new Date(p.divergence.respondBy) <= now
          ? [
              {
                station: {
                  id: r.id,
                  name: stationDisplayName(r.tradeName, r.legalName),
                  city: cityDisplayName(r.city),
                  state: r.state,
                },
                fuelType: p.fuelType,
                stationPrice: p.price,
                consumerPrice: p.divergence.price,
                since: p.divergence.reportedAt,
              },
            ]
          : [],
      ),
    );
  }

  private async modeHistory(stationId: string) {
    const rows = await this.db
      .select({
        mode: stationModeChanges.mode,
        hideReason: stationModeChanges.hideReason,
        requestedBy: stationModeChanges.requestedBy,
        reason: stationModeChanges.reason,
        createdAt: stationModeChanges.createdAt,
        name: users.name,
        email: users.email,
      })
      .from(stationModeChanges)
      .leftJoin(users, eq(users.id, stationModeChanges.decidedByUserId))
      .where(eq(stationModeChanges.stationId, stationId))
      .orderBy(desc(stationModeChanges.createdAt));
    return rows.map((r) => ({
      mode: r.mode,
      hideReason: r.hideReason,
      requestedBy: r.requestedBy,
      reason: r.reason,
      decidedBy: r.name ?? r.email,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ---------- Redes ----------

  async networks(q?: string): Promise<AdminNetworkSummary[]> {
    const filter = q
      ? or(
          sql`${normalized(sql`${organizations.name}`)} like ${normalized(`%${q}%`)}`,
          inArray(
            organizations.id,
            this.db
              .select({ id: organizationMembers.organizationId })
              .from(organizationMembers)
              .innerJoin(users, eq(users.id, organizationMembers.userId))
              .where(ilike(users.email, `%${q}%`)),
          ),
        )
      : undefined;

    const rows = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(filter)
      .orderBy(organizations.name)
      .limit(NETWORK_LIMIT);
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const [units, members] = await Promise.all([
      this.db
        .select({
          organizationId: organizationStations.organizationId,
          total: count(),
        })
        .from(organizationStations)
        .where(inArray(organizationStations.organizationId, ids))
        .groupBy(organizationStations.organizationId),
      this.db
        .select({
          organizationId: organizationMembers.organizationId,
          role: organizationMembers.role,
          name: users.name,
          email: users.email,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .where(inArray(organizationMembers.organizationId, ids)),
    ]);

    return rows.map((r) => {
      const team = members.filter((m) => m.organizationId === r.id);
      return {
        id: r.id,
        name: r.name,
        stations: units.find((u) => u.organizationId === r.id)?.total ?? 0,
        members: team.length,
        owners: team
          .filter((m) => m.role === 'proprietario')
          .map((m) => personLabel(m)),
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  async network(organizationId: string): Promise<AdminNetwork> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    if (!org) throw new NotFoundException('Rede não encontrada.');

    const [team, units, events] = await Promise.all([
      this.organizations.teamOf(organizationId),
      this.db
        .select({
          id: stations.id,
          cnpj: stations.cnpj,
          legalName: stations.legalName,
          tradeName: stations.tradeName,
          city: stations.city,
          state: stations.state,
        })
        .from(organizationStations)
        .innerJoin(stations, eq(stations.id, organizationStations.stationId))
        .where(eq(organizationStations.organizationId, organizationId))
        .orderBy(stations.legalName),
      this.events(organizationId),
    ]);

    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      stations: units.map((u) => ({
        id: u.id,
        name: stationDisplayName(u.tradeName, u.legalName),
        cnpj: formatCnpj(u.cnpj),
        city: cityDisplayName(u.city),
        state: u.state,
      })),
      members: team.members,
      invitations: team.invitations,
      events,
    };
  }

  /** Registro da rede em texto, com nomes de pessoas e unidades. */
  private async events(organizationId: string): Promise<NetworkEvent[]> {
    const rows = await this.db
      .select({
        id: organizationEvents.id,
        action: organizationEvents.action,
        details: organizationEvents.details,
        actorUserId: organizationEvents.actorUserId,
        createdAt: organizationEvents.createdAt,
      })
      .from(organizationEvents)
      .where(eq(organizationEvents.organizationId, organizationId))
      .orderBy(desc(organizationEvents.createdAt))
      .limit(EVENT_LIMIT);

    const userIds = new Set<string>();
    const stationIds = new Set<string>();
    for (const row of rows) {
      if (row.actorUserId) userIds.add(row.actorUserId);
      for (const key of ['userId', 'verifiedOwner']) {
        const value = row.details[key];
        if (typeof value === 'string') userIds.add(value);
      }
      if (typeof row.details.stationId === 'string') {
        stationIds.add(row.details.stationId);
      }
    }
    // inArray com lista vazia vira "false" no Drizzle: sem consulta inválida.
    const [people, places] = await Promise.all([
      this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, [...userIds])),
      this.db
        .select({
          id: stations.id,
          tradeName: stations.tradeName,
          legalName: stations.legalName,
        })
        .from(stations)
        .where(inArray(stations.id, [...stationIds])),
    ]);
    const person = (id: unknown) =>
      personLabel(people.find((p) => p.id === id));
    const place = (id: unknown) => {
      const s = places.find((p) => p.id === id);
      return s ? stationDisplayName(s.tradeName, s.legalName) : 'posto';
    };

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      description: describeEvent(row.action, row.details, person, place),
      actor: row.actorUserId ? person(row.actorUserId) : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private stationQuery() {
    return this.db
      .select(summaryColumns)
      .from(stations)
      .leftJoin(
        organizationStations,
        eq(organizationStations.stationId, stations.id),
      )
      .leftJoin(
        organizations,
        eq(organizations.id, organizationStations.organizationId),
      )
      .$dynamic();
  }
}

function roleLabel(role: unknown): string {
  return typeof role === 'string' && role in ORG_ROLE_LABELS
    ? ORG_ROLE_LABELS[role as OrgRole].toLowerCase()
    : 'membro';
}

/** Texto de um evento do registro da rede (ações em organizations.service). */
export function describeEvent(
  action: string,
  d: Record<string, unknown>,
  person: (id: unknown) => string,
  place: (id: unknown) => string,
): string {
  const text = (() => {
    switch (action) {
      case 'rede_criada':
        return d.origem === 'migracao'
          ? 'Rede criada na migração dos vínculos antigos'
          : 'Rede criada';
      case 'rede_renomeada':
        return `Rede renomeada para "${String(d.name)}"`;
      case 'unidade_adicionada':
        return d.verifiedOwner
          ? `${place(d.stationId)} entrou na rede, com ${person(d.verifiedOwner)} como proprietário verificado`
          : `${place(d.stationId)} entrou na rede`;
      case 'unidade_removida':
        return d.destino
          ? `${place(d.stationId)} saiu da rede (movido para outra rede)`
          : `${place(d.stationId)} saiu da rede`;
      case 'proprietario_verificado':
        return `${person(d.userId)} verificado como proprietário de ${place(d.stationId)}`;
      case 'convite_criado':
        return `Convite para ${String(d.email)} como ${roleLabel(d.role)}`;
      case 'convite_revogado':
        return `Convite para ${String(d.email)} revogado`;
      case 'convite_aceito':
        return `Convite aceito, como ${roleLabel(d.role)}`;
      case 'convite_recusado':
        return 'Convite recusado';
      case 'membro_alterado': {
        const scope =
          d.scope === 'todas'
            ? 'todas as unidades'
            : `${Array.isArray(d.stationIds) ? d.stationIds.length : 0} unidade(s)`;
        return `${person(d.userId)} passou a ${roleLabel(d.role)}, com ${scope}`;
      }
      case 'membro_removido':
        return d.motivo === 'conta_excluida'
          ? `${person(d.userId)} saiu da equipe (conta excluída)`
          : `${person(d.userId)} saiu da equipe`;
      default:
        return action.replace(/_/g, ' ');
    }
  })();
  const byAdmin = d.motivo === 'administrador' ? ' pelo administrador' : '';
  const reason = typeof d.reason === 'string' ? `. Motivo: ${d.reason}` : '';
  return `${text}${byAdmin}${reason}`;
}
