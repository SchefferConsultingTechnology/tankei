import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FUEL_TYPES,
  IQP_DIMENSIONS,
  type CurrentPrice,
  type FuelType,
  type StationCompetition,
  type StationReputation,
} from '@tankei/shared';
import { and, eq } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import { stations } from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { ParametersService } from '../parameters/parameters.service';
import { PriceReferencesService } from '../prices/price-references.service';
import { PriceReportsService } from '../prices/price-reports.service';
import { StationsService } from '../stations/stations.service';
import { UsersService } from '../users/users.service';

/**
 * Dados do portal do posto (ADR 0012 e 0018). Limite concorrencial: só o que o
 * app já mostra publicamente (preços vigentes, IQP, média da ANP), sem
 * sugestão de preço.
 */
@Injectable()
export class PortalService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly stations: StationsService,
    private readonly priceReports: PriceReportsService,
    private readonly references: PriceReferencesService,
    private readonly iqp: IqpService,
    private readonly parameters: ParametersService,
  ) {}

  /** Só gestores do posto (e administradores) acessam os dados do portal. */
  async assertManages(user: AuthenticatedUser, stationId: string) {
    if (user.role === 'admin') return;
    if (!(await this.users.managesStation(user.id, stationId))) {
      throw new ForbiddenException('Você não gerencia este posto.');
    }
  }

  async competition(stationId: string): Promise<StationCompetition> {
    const station = await this.stations.findById(stationId);
    const municipalityCode = await this.municipalityOf(stationId);
    const radius = await this.parameters.get('portal.competition_radius_m');
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
