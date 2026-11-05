import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FUEL_TYPES,
  IQP_DIMENSIONS,
  type CityComparison,
  type CurrentPrice,
  type FuelType,
  type Municipality,
  type OrgAction,
  type PriceHistory,
  type PriceHistoryQuery,
  type StationCompetition,
  type StationReputation,
} from '@tankei/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  municipalities,
  priceReports,
  stations,
  users,
} from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { ParametersService } from '../parameters/parameters.service';
import { PriceReferencesService } from '../prices/price-references.service';
import { PriceReportsService } from '../prices/price-reports.service';
import { StationsService } from '../stations/stations.service';
import { AccessService } from '../organizations/access.service';

/**
 * Dados do portal do posto (ADR 0012 e 0018). Limite concorrencial: só o que o
 * app já mostra publicamente (preços vigentes, IQP, média da ANP), sem
 * sugestão de preço.
 */
@Injectable()
export class PortalService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
    private readonly stations: StationsService,
    private readonly priceReports: PriceReportsService,
    private readonly references: PriceReferencesService,
    private readonly iqp: IqpService,
    private readonly parameters: ParametersService,
  ) {}

  /** Equipe do posto com a ação permitida (ADR 0021); administradores veem. */
  async assertManages(
    user: AuthenticatedUser,
    stationId: string,
    action: OrgAction = 'view',
  ) {
    await this.access.assert(user, stationId, action);
  }

  /** `requestedRadius` fica limitado ao máximo do parâmetro. */
  async competition(
    stationId: string,
    requestedRadius?: number,
  ): Promise<StationCompetition> {
    const station = await this.stations.findById(stationId);
    const municipalityCode = await this.municipalityOf(stationId);
    const maxRadius = await this.parameters.get('portal.competition_radius_m');
    const radius = Math.max(
      1,
      Math.min(requestedRadius ?? maxRadius, maxRadius),
    );
    const fuels = FUEL_TYPES.filter((fuel) => station.fuels.includes(fuel));

    const [nearby, cityPrices, references] = await Promise.all([
      station.location
        ? this.stations.findNearby({
            lat: station.location.lat,
            lng: station.location.lng,
            radius,
          })
        : Promise.resolve([]),
      this.cityPrices(municipalityCode),
      Promise.all(
        fuels.map((fuel) => this.references.latest(fuel, station.state)),
      ),
    ]);
    const competitors = nearby.filter((s) => s.id !== stationId);

    return {
      radiusMeters: radius,
      maxRadiusMeters: maxRadius,
      fuels: fuels.map((fuelType, index) => {
        const price = priceOf(station.prices, fuelType);
        const reference = references[index];
        return {
          fuelType,
          price: price ?? null,
          cityRank: price ? rank(price.price, cityPrices, fuelType) : null,
          stateReference: reference
            ? {
                weekStart: reference.weekStart,
                averagePrice: reference.averagePrice,
                referenceFuel: reference.fuelType,
              }
            : null,
          nearby: competitors
            .flatMap((s) => {
              const p = priceOf(s.prices, fuelType);
              return p
                ? [
                    {
                      id: s.id,
                      name: s.name,
                      brand: s.brand,
                      distanceMeters: s.distanceMeters,
                      price: p,
                    },
                  ]
                : [];
            })
            .sort(
              (a, b) =>
                a.price.price - b.price.price ||
                a.distanceMeters - b.distanceMeters,
            ),
        };
      }),
    };
  }

  async reputation(stationId: string): Promise<StationReputation> {
    const municipalityCode = await this.municipalityOf(stationId);
    const cityIds = await this.cityStationIds(municipalityCode);
    const [detail, latest] = await Promise.all([
      this.iqp.detail(stationId),
      this.iqp.latest(cityIds),
    ]);
    // Só postos com nota (fora "Dados insuficientes") entram na média.
    const scored = [...latest.values()].filter((row) => row.score != null);

    return {
      station: detail,
      city: {
        stations: scored.length,
        score: average(scored.map((row) => row.score!)),
        dimensions: IQP_DIMENSIONS.map((dimension) => ({
          dimension,
          score: average(
            scored.flatMap((row) => {
              const score = row.dimensions[dimension]?.score;
              return score == null ? [] : [score];
            }),
          ),
        })),
      },
    };
  }

  /**
   * Informes do posto no período, do posto e dos consumidores (ADR 0020).
   * Consumidores aparecem sob um apelido estável por posto, sem dados pessoais.
   */
  async history(
    stationId: string,
    query: PriceHistoryQuery,
    now = new Date(),
  ): Promise<PriceHistory> {
    await this.municipalityOf(stationId); // 404 se o posto não existir
    const since = new Date(now.getTime() - query.days * 86_400_000);
    const [rows, current] = await Promise.all([
      this.db
        .select({
          id: priceReports.id,
          fuelType: priceReports.fuelType,
          price: priceReports.price,
          source: priceReports.source,
          status: priceReports.status,
          reportedAt: priceReports.reportedAt,
          reporterUserId: priceReports.reporterUserId,
          reporterName: users.name,
          promotionLabel: priceReports.promotionLabel,
          promotionStartsAt: priceReports.promotionStartsAt,
          promotionEndsAt: priceReports.promotionEndsAt,
        })
        .from(priceReports)
        .leftJoin(users, eq(users.id, priceReports.reporterUserId))
        .where(
          and(
            eq(priceReports.stationId, stationId),
            gt(priceReports.reportedAt, since),
            query.fuel ? eq(priceReports.fuelType, query.fuel) : undefined,
          ),
        )
        .orderBy(desc(priceReports.reportedAt))
        .limit(HISTORY_LIMIT),
      this.priceReports.currentPrices([stationId], now),
    ]);
    const displayed = current.get(stationId) ?? [];

    return {
      days: query.days,
      entries: rows.map((row) => {
        const shown = priceOf(displayed, row.fuelType);
        return {
          id: row.id,
          fuelType: row.fuelType,
          price: row.price,
          source: row.source,
          status: row.status,
          reportedAt: row.reportedAt.toISOString(),
          reporter:
            row.source === 'posto'
              ? `Posto${row.reporterName ? ` (${row.reporterName.split(' ')[0]})` : ''}`
              : row.source === 'anp'
                ? 'ANP'
                : `Consumidor ${pseudonym(row.reporterUserId, stationId)}`,
          promotion:
            row.promotionLabel && row.promotionStartsAt && row.promotionEndsAt
              ? {
                  label: row.promotionLabel,
                  startsAt: row.promotionStartsAt.toISOString(),
                  endsAt: row.promotionEndsAt.toISOString(),
                }
              : null,
          current:
            !!shown &&
            shown.updatedAt === row.reportedAt.toISOString() &&
            shown.price === row.price,
        };
      }),
    };
  }

  /** Preços de outra cidade comparados aos do posto (só dados públicos). */
  async cityComparison(
    stationId: string,
    code: string,
  ): Promise<CityComparison> {
    const station = await this.stations.findById(stationId);
    const [municipality] = await this.db
      .select({
        code: municipalities.code,
        name: municipalities.name,
        state: municipalities.state,
      })
      .from(municipalities)
      .where(eq(municipalities.code, code));
    if (!municipality) throw new NotFoundException('Município não encontrado.');

    const prices = await this.cityPrices(code);
    const fuels = FUEL_TYPES.filter((fuel) => station.fuels.includes(fuel));
    return {
      municipality: municipality as Municipality,
      fuels: fuels.map((fuelType) => {
        const values = prices
          .filter((p) => p.fuelType === fuelType)
          .map((p) => p.price)
          .sort((a, b) => a - b);
        const own = priceOf(station.prices, fuelType)?.price ?? null;
        return {
          fuelType,
          ownPrice: own,
          stations: values.length,
          min: values[0] ?? null,
          average:
            values.length === 0
              ? null
              : Math.round(
                  (values.reduce((sum, v) => sum + v, 0) / values.length) *
                    1000,
                ) / 1000,
          median: median(values),
          positionThere:
            own === null || values.length === 0
              ? null
              : {
                  // O posto entra na conta como se estivesse lá.
                  position: 1 + values.filter((v) => v < own).length,
                  total: values.length + 1,
                },
        };
      }),
    };
  }

  private async municipalityOf(stationId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ code: stations.municipalityCode })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.active, true)));
    if (!row) throw new NotFoundException('Posto não encontrado.');
    return row.code;
  }

  private async cityStationIds(code: string | null): Promise<string[]> {
    if (!code) return [];
    const rows = await this.db
      .select({ id: stations.id })
      .from(stations)
      .where(
        and(eq(stations.municipalityCode, code), eq(stations.active, true)),
      );
    return rows.map((row) => row.id);
  }

  /** Preços vigentes de todos os postos da cidade (para a posição no ranking). */
  private async cityPrices(code: string | null): Promise<CurrentPrice[]> {
    const ids = await this.cityStationIds(code);
    const prices = await this.priceReports.currentPrices(ids);
    return [...prices.values()].flat();
  }
}

/** Informes por consulta de histórico (o período máximo é 90 dias). */
const HISTORY_LIMIT = 500;

/** Apelido estável do consumidor neste posto: o mesmo em todo o histórico. */
function pseudonym(userId: string | null, stationId: string): string {
  if (!userId) return 'anônimo';
  return createHash('sha256')
    .update(`${stationId}:${userId}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 1000) / 1000;
}

function priceOf(prices: CurrentPrice[], fuel: FuelType) {
  return prices.find((p) => p.fuelType === fuel);
}

/** Posição de um preço entre os da cidade: 1 + quantos são mais baratos. */
function rank(price: number, cityPrices: CurrentPrice[], fuel: FuelType) {
  const values = cityPrices.filter((p) => p.fuelType === fuel);
  return {
    position: 1 + values.filter((p) => p.price < price).length,
    total: values.length,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}
