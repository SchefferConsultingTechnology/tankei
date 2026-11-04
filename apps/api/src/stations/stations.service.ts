import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  NEARBY_MAX_RESULTS,
  type FuelType,
  type NearbyQuery,
  type NearbyStation,
  type Station,
} from '@tankei/shared';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { stationFuels, stations } from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { PriceReportsService } from '../prices/price-reports.service';
import { brandDisplayName, stationDisplayName } from './display-name';

/** Colunas comuns à busca e ao detalhe, com os combustíveis agregados. */
const stationColumns = {
  id: stations.id,
  legalName: stations.legalName,
  tradeName: stations.tradeName,
  brand: stations.brand,
  address: stations.address,
  district: stations.district,
  city: stations.city,
  state: stations.state,
  location: stations.location,
  // text[] porque o driver pg não converte arrays de enum.
  fuels: sql<
    FuelType[]
  >`coalesce(array_agg(${stationFuels.fuelType}::text order by ${stationFuels.fuelType}) filter (where ${stationFuels.fuelType} is not null), '{}')`,
};

interface StationRow {
  id: string;
  legalName: string;
  tradeName: string | null;
  brand: string;
  address: string;
  district: string | null;
  city: string;
  state: string;
  location: { x: number; y: number } | null;
  fuels: FuelType[];
}

@Injectable()
export class StationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly priceReports: PriceReportsService,
    private readonly iqp: IqpService,
  ) {}

  /**
   * Postos ativos dentro do raio, do mais próximo ao mais distante.
   * Postos ainda sem coordenada não aparecem.
   */
  async findNearby(query: NearbyQuery): Promise<NearbyStation[]> {
    const origin = sql`ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography`;
    const location = sql`${stations.location}::geography`;
    const distance = sql<number>`ST_Distance(${location}, ${origin})`;

    const rows = await this.db
      .select({ ...stationColumns, distance })
      .from(stations)
      .leftJoin(stationFuels, eq(stationFuels.stationId, stations.id))
      .where(
        and(
          eq(stations.active, true),
          isNotNull(stations.location),
          // ST_DWithin usa o índice stations_location_geography_idx.
          sql`ST_DWithin(${location}, ${origin}, ${query.radius})`,
        ),
      )
      .groupBy(stations.id)
      .having(
        query.fuel
          ? sql`bool_or(${stationFuels.fuelType} = ${query.fuel})`
          : undefined,
      )
      .orderBy(distance)
      .limit(NEARBY_MAX_RESULTS);

    const enriched = await this.enrich(rows);
    return enriched.map((station, index) => ({
      ...station,
      // isNotNull no where garante a coordenada.
      location: station.location!,
      distanceMeters: Math.round(rows[index].distance),
    }));
  }

  /** Posto ativo com preços vigentes e resumo do IQP. */
  async findById(id: string): Promise<Station> {
    const rows = await this.db
      .select(stationColumns)
      .from(stations)
      .leftJoin(stationFuels, eq(stationFuels.stationId, stations.id))
      .where(and(eq(stations.id, id), eq(stations.active, true)))
      .groupBy(stations.id);
    if (rows.length === 0) throw new NotFoundException('Posto não encontrado.');

    const [station] = await this.enrich(rows);
    return station;
  }

  private async enrich(rows: StationRow[]): Promise<Station[]> {
    const ids = rows.map((row) => row.id);
    const [prices, iqpScores] = await Promise.all([
      this.priceReports.currentPrices(ids),
      this.iqp.latest(ids),
    ]);

    return rows.map((row) => ({
      id: row.id,
      name: stationDisplayName(row.tradeName, row.legalName),
      brand: brandDisplayName(row.brand),
      address: row.address,
      district: row.district,
      city: row.city,
      state: row.state,
      location: row.location
        ? { lat: row.location.y, lng: row.location.x }
        : null,
      fuels: row.fuels,
      prices: prices.get(row.id) ?? [],
      iqp: this.iqp.summary(iqpScores.get(row.id)),
    }));
  }
}
