import { Inject, Injectable } from '@nestjs/common';
import {
  NEARBY_MAX_RESULTS,
  type FuelType,
  type NearbyQuery,
  type NearbyStation,
} from '@tankei/shared';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { stationFuels, stations } from '../database/schema';
import { PriceReportsService } from '../prices/price-reports.service';

@Injectable()
export class StationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly priceReports: PriceReportsService,
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
      .select({
        id: stations.id,
        legalName: stations.legalName,
        tradeName: stations.tradeName,
        brand: stations.brand,
        address: stations.address,
        district: stations.district,
        city: stations.city,
        state: stations.state,
        location: stations.location,
        distance,
        // text[] porque o driver pg não converte arrays de enum.
        fuels: sql<
          FuelType[]
        >`coalesce(array_agg(${stationFuels.fuelType}::text order by ${stationFuels.fuelType}) filter (where ${stationFuels.fuelType} is not null), '{}')`,
      })
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

    const prices = await this.priceReports.currentPrices(
      rows.map((row) => row.id),
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.tradeName ?? row.legalName,
      brand: row.brand,
      address: row.address,
      district: row.district,
      city: row.city,
      state: row.state,
      // isNotNull no where garante a coordenada.
      location: { lat: row.location!.y, lng: row.location!.x },
      distanceMeters: Math.round(row.distance),
      fuels: row.fuels,
      prices: prices.get(row.id) ?? [],
    }));
  }
}
