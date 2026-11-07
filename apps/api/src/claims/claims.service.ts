import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CLAIM_POSITION_LABELS } from '@tankei/shared';
import type {
  AdminClaim,
  ApproveClaim,
  Claim,
  ClaimableStation,
  ClaimStationSearch,
  ClaimStatus,
  CreateClaim,
  StationClaimNotice,
} from '@tankei/shared';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import { normalized } from '../database/normalized';
import {
  stationClaimDecisions,
  stationClaimDisputes,
  stationClaims,
  stationManagers,
  stations,
  users,
} from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MailService } from '../mail/mail.service';
import {
  claimDecidedMail,
  claimDisputedMail,
  claimToAdminsMail,
  claimToOwnersMail,
} from '../mail/templates';
import { ParametersService } from '../parameters/parameters.service';
import {
  brandDisplayName,
  cityDisplayName,
  formatCnpj,
  stationDisplayName,
} from '../stations/display-name';

const SEARCH_LIMIT = 20;

const stationColumns = {
  id: stations.id,
  cnpj: stations.cnpj,
  legalName: stations.legalName,
  tradeName: stations.tradeName,
  brand: stations.brand,
  address: stations.address,
  city: stations.city,
  state: stations.state,
};

type StationRow = {
  id: string;
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  brand: string;
  address: string;
  city: string;
  state: string;
};

function toClaimable(row: StationRow): ClaimableStation {
  return {
    id: row.id,
    name: stationDisplayName(row.tradeName, row.legalName),
    legalName: row.legalName,
    cnpj: formatCnpj(row.cnpj),
    brand: brandDisplayName(row.brand),
    address: row.address,
    city: cityDisplayName(row.city),
    state: row.state,
  };
}

/**
 * Reivindicação de posto (ADR 0019): a pessoa pede, o administrador verifica o
 * vínculo (ADR 0011) e aprova ou recusa. A aprovação cria o vínculo de
 * responsável com a forma de verificação registrada.
 */
@Injectable()
export class ClaimsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly parameters: ParametersService,
    private readonly access: AccessService,
    private readonly organizations: OrganizationsService,
    private readonly mail: MailService,
  ) {}

  /** Postos ativos por CNPJ (dígitos, pode ser parcial) ou por nome. */
  async searchStations(query: ClaimStationSearch): Promise<ClaimableStation[]> {
    const digits = query.q.replace(/\D/g, '');
    const looksLikeCnpj = digits.length >= 8 && !/[a-z]/i.test(query.q);

    const filter = looksLikeCnpj
      ? sql`${stations.cnpj} like ${`${digits}%`}`
      : and(
          sql`${normalized(sql`coalesce(${stations.tradeName}, '') || ' ' || ${stations.legalName}`)} like ${normalized(`%${query.q}%`)}`,
          query.state ? eq(stations.state, query.state) : undefined,
        );

    const rows = await this.db
      .select(stationColumns)
      .from(stations)
      .where(and(eq(stations.active, true), filter))
      .orderBy(stations.state, stations.city, stations.legalName)
      .limit(SEARCH_LIMIT);
    return rows.map(toClaimable);
  }

  /** Um posto ativo, para o pedido que chega com o posto escolhido (ADR 0031). */
  async claimableStation(stationId: string): Promise<ClaimableStation> {
    const [row] = await this.db
      .select(stationColumns)
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.active, true)));
    if (!row) throw new NotFoundException('Posto não encontrado.');
    return toClaimable(row);
  }

  async create(userId: string, body: CreateClaim): Promise<Claim> {
    const [station] = await this.db
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.id, body.stationId), eq(stations.active, true)));
    if (!station) throw new NotFoundException('Posto não encontrado.');

    if (await this.access.roleAt(userId, body.stationId)) {
      throw new ConflictException('Você já gerencia este posto.');
    }

    const pending = await this.pendingOf(userId);
    if (pending.some((p) => p.stationId === body.stationId)) {
      throw new ConflictException(
        'Você já tem um pedido em análise para este posto.',
      );
    }
    const max = await this.parameters.get('claim.max_pending_per_user');
    if (pending.length >= max) {
      throw new ConflictException(
        `Você já tem ${pending.length} pedidos em análise. Aguarde a resposta antes de pedir outro posto.`,
      );
    }

    const [created] = await this.db
      .insert(stationClaims)
      .values({
        stationId: body.stationId,
        userId,
        contactName: body.contactName,
        phone: body.phone,
        position: body.position,
        message: body.message || null,
        origin: body.origin,
      })
      .returning({ id: stationClaims.id });
    const [claim] = await this.list({ claimIds: [created.id] });
    const result = toClaim(claim);
    this.mail.background(() =>
      this.announceClaim(result, body.stationId, body.contactName),
    );
    return result;
  }

  /**
   * Avisos do pedido (ADR 0025): à equipe Tankei, para analisar, e a quem já
   * é proprietário do posto, que pode contestar um pedido indevido (ADR 0011).
   */
  private async announceClaim(
    claim: Claim,
    stationId: string,
    contactName: string,
  ) {
    const positionLabel = CLAIM_POSITION_LABELS[claim.position];
    this.mail.notify(
      await this.mail.adminEmails(),
      claimToAdminsMail({
        stationName: claim.station.name,
        city: `${claim.station.city}/${claim.station.state}`,
        contactName,
        positionLabel,
      }),
    );
    const owners = await this.access.recipients(stationId, 'manage_team');
    this.mail.notify(
      owners.map((o) => o.email),
      claimToOwnersMail({
        stationName: claim.station.name,
        stationId,
        contactName,
        positionLabel,
      }),
    );
  }

  /** Pedidos da pessoa, os mais recentes primeiro. */
  async mine(userId: string): Promise<Claim[]> {
    const rows = await this.list({ userId });
    return rows.map(toClaim);
  }

  /** Fila do administrador, por situação. Em análise: os mais antigos primeiro. */
  async adminList(status: ClaimStatus): Promise<AdminClaim[]> {
    const rows = await this.list({ status });
    if (status === 'em_analise') rows.reverse();

    const stationIds = [...new Set(rows.map((r) => r.station.id))];
    const managerCounts =
      stationIds.length === 0
        ? []
        : await this.db
            .select({ stationId: stationManagers.stationId, total: count() })
            .from(stationManagers)
            .where(inArray(stationManagers.stationId, stationIds))
            .groupBy(stationManagers.stationId);
    const managersOf = new Map(
      managerCounts.map((m) => [m.stationId, m.total]),
    );

    const disputes = await this.disputesOf(rows.map((r) => r.id));
    return rows.map((row) => ({
      ...toClaim(row),
      contactName: row.contactName,
      phone: row.phone,
      message: row.message,
      origin: row.origin,
      account: row.account,
      currentManagers: managersOf.get(row.station.id) ?? 0,
      verificationMethod: row.verificationMethod,
      disputes: disputes.get(row.id) ?? [],
    }));
  }

  // ---------- Proprietário atual (ADR 0011 e 0027) ----------

  /** Pedidos em análise de outras pessoas para o posto. */
  async stationNotices(
    user: AuthenticatedUser,
    stationId: string,
  ): Promise<StationClaimNotice[]> {
    await this.access.assert(user, stationId, 'manage_team');
    const rows = await this.db
      .select({
        id: stationClaims.id,
        userId: stationClaims.userId,
        contactName: stationClaims.contactName,
        position: stationClaims.position,
        createdAt: stationClaims.createdAt,
      })
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
      )
      .orderBy(desc(stationClaims.createdAt));
    const mine = new Set(
      (
        await this.db
          .select({ claimId: stationClaimDisputes.claimId })
          .from(stationClaimDisputes)
          .where(eq(stationClaimDisputes.userId, user.id))
      ).map((d) => d.claimId),
    );
    return rows
      .filter((r) => r.userId !== user.id)
      .map((r) => ({
        id: r.id,
        contactName: r.contactName,
        position: r.position,
        createdAt: r.createdAt.toISOString(),
        disputedByMe: mine.has(r.id),
      }));
  }

  /** "Não reconheço este pedido": a equipe Tankei vê antes de decidir. */
  async dispute(
    user: AuthenticatedUser,
    stationId: string,
    claimId: string,
    reason: string,
  ): Promise<void> {
    await this.access.assert(user, stationId, 'manage_team');
    const claim = await this.pendingClaim(claimId);
    if (claim.stationId !== stationId) {
      throw new NotFoundException('Pedido não encontrado.');
    }
    if (claim.userId === user.id) {
      throw new BadRequestException('Este pedido é seu.');
    }
    const inserted = await this.db
      .insert(stationClaimDisputes)
      .values({ claimId, userId: user.id, reason })
      .onConflictDoNothing()
      .returning({ id: stationClaimDisputes.id });
    if (inserted.length === 0) {
      throw new ConflictException('Você já contestou este pedido.');
    }
    this.mail.background(async () => {
      const [row] = await this.list({ claimIds: [claimId] });
      const [owner] = await this.db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, user.id));
      this.mail.notify(
        await this.mail.adminEmails(),
        claimDisputedMail({
          stationName: row.station.name,
          ownerName: owner?.name ?? owner?.email ?? 'O proprietário',
          contactName: row.contactName ?? 'conta excluída',
          reason,
        }),
      );
    });
  }

  private async disputesOf(claimIds: string[]) {
    const result = new Map<
      string,
      { by: string | null; reason: string; createdAt: string }[]
    >();
    if (claimIds.length === 0) return result;
    const rows = await this.db
      .select({
        claimId: stationClaimDisputes.claimId,
        reason: stationClaimDisputes.reason,
        createdAt: stationClaimDisputes.createdAt,
        name: users.name,
        email: users.email,
      })
      .from(stationClaimDisputes)
      .leftJoin(users, eq(users.id, stationClaimDisputes.userId))
      .where(inArray(stationClaimDisputes.claimId, claimIds))
      .orderBy(stationClaimDisputes.createdAt);
    for (const row of rows) {
      result.set(row.claimId, [
        ...(result.get(row.claimId) ?? []),
        {
          by: row.name ?? row.email,
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
        },
      ]);
    }
    return result;
  }

  /** Aprova: registra a decisão e cria o vínculo de responsável, juntos. */
  async approve(
    claimId: string,
    adminId: string,
    body: ApproveClaim,
  ): Promise<AdminClaim> {
    const claim = await this.pendingClaim(claimId);
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx.insert(stationClaimDecisions).values({
        claimId,
        decision: 'aprovado',
        verificationMethod: body.verificationMethod,
        decidedByUserId: adminId,
        decidedAt: now,
      });
      // Comprovação do vínculo (ADR 0011); já comprovado, fica como está.
      await tx
        .insert(stationManagers)
        .values({
          userId: claim.userId,
          stationId: claim.stationId,
          role: 'responsavel',
          verificationMethod: body.verificationMethod,
          verifiedAt: now,
          createdByUserId: adminId,
        })
        .onConflictDoNothing();
      // Acesso pelo portal: o posto entra na rede da pessoa (ADR 0021).
      await this.organizations.grantVerifiedOwnership(
        tx,
        claim.userId,
        claim.stationId,
        adminId,
      );
    });
    const result = await this.adminOne(claimId);
    this.mail.background(() => this.announceDecision(claim.userId, result));
    return result;
  }

  private async announceDecision(userId: string, claim: AdminClaim) {
    const email = await this.mail.emailOf(userId);
    if (!email) return;
    this.mail.notify(
      [email],
      claimDecidedMail({
        stationName: claim.station.name,
        approved: claim.status === 'aprovado',
        reason: claim.reason,
      }),
    );
  }

  async reject(
    claimId: string,
    adminId: string,
    reason: string,
  ): Promise<AdminClaim> {
    const claim = await this.pendingClaim(claimId);
    await this.db.insert(stationClaimDecisions).values({
      claimId,
      decision: 'recusado',
      reason,
      decidedByUserId: adminId,
    });
    const result = await this.adminOne(claimId);
    this.mail.background(() => this.announceDecision(claim.userId, result));
    return result;
  }

  private async adminOne(claimId: string): Promise<AdminClaim> {
    const [row] = await this.list({ claimIds: [claimId] });
    const [managers] = await this.db
      .select({ total: count() })
      .from(stationManagers)
      .where(eq(stationManagers.stationId, row.station.id));
    return {
      ...toClaim(row),
      contactName: row.contactName,
      phone: row.phone,
      message: row.message,
      origin: row.origin,
      account: row.account,
      currentManagers: managers.total,
      verificationMethod: row.verificationMethod,
      disputes: (await this.disputesOf([claimId])).get(claimId) ?? [],
    };
  }

  private async pendingClaim(claimId: string) {
    const [row] = await this.db
      .select({
        userId: stationClaims.userId,
        stationId: stationClaims.stationId,
        decided: stationClaimDecisions.id,
      })
      .from(stationClaims)
      .leftJoin(
        stationClaimDecisions,
        eq(stationClaimDecisions.claimId, stationClaims.id),
      )
      .where(eq(stationClaims.id, claimId));
    if (!row) throw new NotFoundException('Pedido não encontrado.');
    if (row.decided) {
      throw new BadRequestException('Este pedido já foi analisado.');
    }
    return row;
  }

  private async pendingOf(userId: string) {
    return this.db
      .select({ stationId: stationClaims.stationId })
      .from(stationClaims)
      .leftJoin(
        stationClaimDecisions,
        eq(stationClaimDecisions.claimId, stationClaims.id),
      )
      .where(
        and(eq(stationClaims.userId, userId), isNull(stationClaimDecisions.id)),
      );
  }

  private async list(filter: {
    userId?: string;
    status?: ClaimStatus;
    claimIds?: string[];
  }) {
    const statusFilter =
      filter.status === 'em_analise'
        ? isNull(stationClaimDecisions.id)
        : filter.status === 'aprovado'
          ? eq(stationClaimDecisions.decision, 'aprovado')
          : filter.status === 'recusado'
            ? eq(stationClaimDecisions.decision, 'recusado')
            : undefined;

    const rows = await this.db
      .select({
        id: stationClaims.id,
        position: stationClaims.position,
        contactName: stationClaims.contactName,
        phone: stationClaims.phone,
        message: stationClaims.message,
        origin: stationClaims.origin,
        createdAt: stationClaims.createdAt,
        decision: stationClaimDecisions.decision,
        reason: stationClaimDecisions.reason,
        verificationMethod: stationClaimDecisions.verificationMethod,
        decidedAt: stationClaimDecisions.decidedAt,
        accountId: users.id,
        accountName: users.name,
        accountEmail: users.email,
        station: stationColumns,
      })
      .from(stationClaims)
      .innerJoin(stations, eq(stations.id, stationClaims.stationId))
      .innerJoin(users, eq(users.id, stationClaims.userId))
      .leftJoin(
        stationClaimDecisions,
        eq(stationClaimDecisions.claimId, stationClaims.id),
      )
      .where(
        and(
          filter.userId ? eq(stationClaims.userId, filter.userId) : undefined,
          filter.claimIds
            ? inArray(stationClaims.id, filter.claimIds)
            : undefined,
          statusFilter,
        ),
      )
      .orderBy(desc(stationClaims.createdAt));

    return rows.map((row) => ({
      ...row,
      station: toClaimable(row.station),
      account: {
        id: row.accountId,
        name: row.accountName,
        email: row.accountEmail,
      },
    }));
  }
}

function toClaim(row: {
  id: string;
  station: ClaimableStation;
  position: Claim['position'];
  decision: 'aprovado' | 'recusado' | null;
  reason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}): Claim {
  return {
    id: row.id,
    station: row.station,
    position: row.position,
    status: row.decision ?? 'em_analise',
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    reason: row.reason,
  };
}
