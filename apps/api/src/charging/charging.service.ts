import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CHARGER_CURRENTS,
  CHARGER_FUEL,
  CHARGING_FUELS,
  CONNECTORS,
  type Charger,
  type ChargerCurrent,
  type ChargingAdmin,
  type Connector,
  type DismissChargerSuggestions,
  type SetChargers,
  type StationCharging,
  type SuggestCharger,
  type SuggestChargerResult,
} from '@tankei/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  chargerSuggestionDismissals,
  chargerSuggestions,
  stationChargerVersions,
  stationFuels,
  stations,
  users,
} from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { ParametersService } from '../parameters/parameters.service';

interface Official {
  source: 'posto' | 'equipe';
  chargers: Charger[];
  createdAt: Date;
  userName: string | null;
}

interface SuggestionTally {
  current: ChargerCurrent;
  people: number;
  connectors: Connector[];
  lastAt: Date;
}

/**
 * Recarga elétrica no posto (ADR 0041). O cadastro oficial (posto ou equipe)
 * prevalece; sem ele, valem as sugestões de consumidores confirmadas por
 * charger.min_confirmations pessoas. Os "combustíveis" recarga_ac/dc do posto
 * (station_fuels) acompanham o que está valendo, para a lista, o filtro e os
 * informes de preço funcionarem como nos outros combustíveis.
 */
@Injectable()
export class ChargingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
    private readonly parameters: ParametersService,
  ) {}

  // --- Leitura ---

  private async officials(ids: string[]): Promise<Map<string, Official>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .selectDistinctOn([stationChargerVersions.stationId], {
        stationId: stationChargerVersions.stationId,
        source: stationChargerVersions.source,
        chargers: stationChargerVersions.chargers,
        createdAt: stationChargerVersions.createdAt,
        userName: users.name,
      })
      .from(stationChargerVersions)
      .leftJoin(users, eq(users.id, stationChargerVersions.userId))
      .where(inArray(stationChargerVersions.stationId, ids))
      .orderBy(
        stationChargerVersions.stationId,
        desc(stationChargerVersions.createdAt),
      );
    return new Map(
      rows.map((r) => [
        r.stationId,
        {
          source: r.source === 'posto' ? 'posto' : 'equipe',
          chargers: r.chargers,
          createdAt: r.createdAt,
          userName: r.userName,
        },
      ]),
    );
  }

  /** Sugestões que ainda contam (depois do último descarte), por posto e tipo. */
  private async tallies(
    ids: string[],
  ): Promise<Map<string, SuggestionTally[]>> {
    if (ids.length === 0) return new Map();
    const [suggestions, dismissals] = await Promise.all([
      this.db
        .select({
          stationId: chargerSuggestions.stationId,
          userId: chargerSuggestions.userId,
          current: chargerSuggestions.current,
          connector: chargerSuggestions.connector,
          createdAt: chargerSuggestions.createdAt,
        })
        .from(chargerSuggestions)
        .where(inArray(chargerSuggestions.stationId, ids)),
      this.db
        .select({
          stationId: chargerSuggestionDismissals.stationId,
          current: chargerSuggestionDismissals.current,
          createdAt: chargerSuggestionDismissals.createdAt,
        })
        .from(chargerSuggestionDismissals)
        .where(inArray(chargerSuggestionDismissals.stationId, ids)),
    ]);
    const cutoff = new Map<string, number>();
    for (const d of dismissals) {
      const key = `${d.stationId}:${d.current}`;
      cutoff.set(key, Math.max(cutoff.get(key) ?? 0, d.createdAt.getTime()));
    }

    const groups = new Map<string, typeof suggestions>();
    for (const s of suggestions) {
      const key = `${s.stationId}:${s.current}`;
      if (s.createdAt.getTime() <= (cutoff.get(key) ?? 0)) continue;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }

    const result = new Map<string, SuggestionTally[]>();
    for (const [key, list] of groups) {
      const [stationId, current] = key.split(':');
      const connectorCount = new Map<Connector, number>();
      for (const s of list) {
        if (
          s.connector &&
          (CONNECTORS as readonly string[]).includes(s.connector)
        ) {
          const c = s.connector as Connector;
          connectorCount.set(c, (connectorCount.get(c) ?? 0) + 1);
        }
      }
      const tally: SuggestionTally = {
        current: current as ChargerCurrent,
        people: new Set(list.map((s) => s.userId)).size,
        // Do mais citado ao menos citado.
        connectors: [...connectorCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([c]) => c),
        lastAt: new Date(Math.max(...list.map((s) => s.createdAt.getTime()))),
      };
      result.set(stationId, [...(result.get(stationId) ?? []), tally]);
    }
    return result;
  }

  /** Recarga que vale para o app, por posto (nulo: sem recarga). */
  async current(ids: string[]): Promise<Map<string, StationCharging | null>> {
    if (ids.length === 0) return new Map();
    const [officials, tallies, min] = await Promise.all([
      this.officials(ids),
      this.tallies(ids),
      this.parameters.get('charger.min_confirmations'),
    ]);
    const result = new Map<string, StationCharging | null>();
    for (const id of ids) {
      const official = officials.get(id);
      if (official) {
        result.set(
          id,
          official.chargers.length === 0
            ? null
            : {
                source: official.source,
                chargers: official.chargers.map((c) => ({
                  current: c.current,
                  connector: c.connector,
                  powerKw: c.powerKw,
                  count: c.count,
                  access: c.access,
                  payments: c.payments,
                  operator: c.operator || null,
                  timeBased: c.timeBased,
                  fees: c.fees || null,
                })),
                updatedAt: official.createdAt.toISOString(),
              },
        );
        continue;
      }
      const confirmed = (tallies.get(id) ?? []).filter((t) => t.people >= min);
      result.set(
        id,
        confirmed.length === 0
          ? null
          : {
              source: 'usuarios',
              chargers: CHARGER_CURRENTS.flatMap((current) =>
                confirmed
                  .filter((t) => t.current === current)
                  .map((t) => ({
                    current,
                    connector: t.connectors[0] ?? null,
                    powerKw: null,
                    count: null,
                    access: null,
                    payments: [],
                    operator: null,
                    timeBased: false,
                    fees: null,
                  })),
              ),
              updatedAt: new Date(
                Math.max(...confirmed.map((t) => t.lastAt.getTime())),
              ).toISOString(),
            },
      );
    }
    return result;
  }

  /** Mantém recarga_ac/dc em station_fuels de acordo com o que vale. */
  private async syncFuels(stationId: string) {
    const charging = (await this.current([stationId])).get(stationId);
    const active = [
      ...new Set(
        (charging?.chargers ?? []).map((c) => CHARGER_FUEL[c.current]),
      ),
    ];
    const inactive = CHARGING_FUELS.filter((f) => !active.includes(f));
    if (active.length > 0) {
      await this.db
        .insert(stationFuels)
        .values(active.map((fuelType) => ({ stationId, fuelType })))
        .onConflictDoNothing();
    }
    // Só os tipos de recarga: os combustíveis nunca são removidos aqui.
    if (inactive.length > 0) {
      await this.db
        .delete(stationFuels)
        .where(
          and(
            eq(stationFuels.stationId, stationId),
            inArray(stationFuels.fuelType, inactive),
          ),
        );
    }
  }

  // --- Cadastro oficial ---

  async admin(stationId: string): Promise<ChargingAdmin> {
    await this.assertStation(stationId);
    const [officials, tallies, min] = await Promise.all([
      this.officials([stationId]),
      this.tallies([stationId]),
      this.parameters.get('charger.min_confirmations'),
    ]);
    const official = officials.get(stationId);
    return {
      official: official
        ? {
            source: official.source,
            chargers: official.chargers,
            updatedAt: official.createdAt.toISOString(),
            updatedBy: official.userName,
          }
        : null,
      suggestions: (tallies.get(stationId) ?? []).map((t) => ({
        current: t.current,
        people: t.people,
        connectors: t.connectors,
        confirmed: t.people >= min,
        lastAt: t.lastAt.toISOString(),
      })),
      minConfirmations: min,
    };
  }

  async forPortal(user: AuthenticatedUser, stationId: string) {
    await this.access.assert(user, stationId, 'view');
    return this.admin(stationId);
  }

  async setFromPortal(
    user: AuthenticatedUser,
    stationId: string,
    body: SetChargers,
  ) {
    await this.access.assert(user, stationId, 'manage_info');
    return this.save(stationId, body, 'posto', user.id);
  }

  async setFromAdmin(
    user: AuthenticatedUser,
    stationId: string,
    body: SetChargers,
  ) {
    await this.assertStation(stationId);
    return this.save(stationId, body, 'equipe', user.id);
  }

  private async save(
    stationId: string,
    body: SetChargers,
    source: 'posto' | 'equipe',
    userId: string,
  ): Promise<ChargingAdmin> {
    await this.db.insert(stationChargerVersions).values({
      stationId,
      chargers: body.chargers.map((c) => ({
        ...c,
        payments: [...new Set(c.payments)],
        operator: c.operator || undefined,
        fees: c.fees || undefined,
      })),
      source,
      userId,
    });
    await this.syncFuels(stationId);
    return this.admin(stationId);
  }

  // --- Sugestões de consumidores ---

  async suggest(
    user: AuthenticatedUser,
    stationId: string,
    body: SuggestCharger,
  ): Promise<SuggestChargerResult> {
    await this.assertStation(stationId);
    if (await this.access.roleAt(user.id, stationId)) {
      throw new ForbiddenException(
        'A equipe do posto cadastra a recarga pelo portal, em Dados do posto.',
      );
    }
    const official = (await this.officials([stationId])).get(stationId);
    if (official) {
      throw new ConflictException(
        'O posto já informou os pontos de recarga. Se estiver errado, avise a equipe Tankei.',
      );
    }

    const before = (await this.tallies([stationId])).get(stationId) ?? [];
    const already = await this.db
      .select({
        id: chargerSuggestions.id,
        createdAt: chargerSuggestions.createdAt,
      })
      .from(chargerSuggestions)
      .where(
        and(
          eq(chargerSuggestions.stationId, stationId),
          eq(chargerSuggestions.userId, user.id),
          eq(chargerSuggestions.current, body.current),
        ),
      )
      .orderBy(desc(chargerSuggestions.createdAt))
      .limit(1);
    const counted = before.find((t) => t.current === body.current);
    // A mesma pessoa conta uma vez (desde o último descarte).
    if (!(already[0] && counted && already[0].createdAt <= counted.lastAt)) {
      await this.db.insert(chargerSuggestions).values({
        stationId,
        userId: user.id,
        current: body.current,
        connector: body.connector ?? null,
      });
    }
    await this.syncFuels(stationId);

    const min = await this.parameters.get('charger.min_confirmations');
    const tally = ((await this.tallies([stationId])).get(stationId) ?? []).find(
      (t) => t.current === body.current,
    );
    const confirmed = (tally?.people ?? 0) >= min;
    return {
      confirmed,
      message: confirmed
        ? 'Obrigado! A recarga já aparece no app para todos.'
        : 'Obrigado! A recarga aparece no app quando outro motorista confirmar.',
    };
  }

  async dismiss(
    user: AuthenticatedUser,
    stationId: string,
    body: DismissChargerSuggestions,
  ): Promise<ChargingAdmin> {
    await this.assertStation(stationId);
    await this.db.insert(chargerSuggestionDismissals).values({
      stationId,
      current: body.current,
      reason: body.reason,
      userId: user.id,
    });
    await this.syncFuels(stationId);
    return this.admin(stationId);
  }

  private async assertStation(stationId: string) {
    const [station] = await this.db
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.active, true)));
    if (!station) throw new NotFoundException('Posto não encontrado.');
  }
}
