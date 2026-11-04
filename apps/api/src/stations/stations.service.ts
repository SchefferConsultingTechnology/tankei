import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CITY_STATIONS_LIMIT,
  NEARBY_MAX_RESULTS,
  type CityStations,
  type CityStationsQuery,
  type CityWithStations,
  type FuelType,
  type Municipality,
  type NearbyQuery,
  type NearbyStation,
  type Station,
} from '@tankei/shared';
import { and, asc, count, eq, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { municipalities, stationFuels, stations } from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { PriceReportsService } from '../prices/price-reports.service';
import {
  brandDisplayName,
  cityDisplayName,
  stationDisplayName,
} from './display-name';

/**
 * Colunas comuns às consultas de postos, com os combustíveis agregados e o
 * nome oficial do município. Exigem os joins com station_fuels e municipalities.
 */
const stationColumns = {
  id: stations.id,
  legalName: stations.legalName,
  tradeName: stations.tradeName,
  brand: stations.brand,
  address: stations.address,
  district: stations.district,
  city: stations.city,
  municipalityName: municipalities.name,
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
  municipalityName: string | null;
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
      .leftJoin(
        municipalities,
        eq(municipalities.code, stations.municipalityCode),
      )
      .where(
        and(
          eq(stations.active, true),
          isNotNull(stations.location),
          // ST_DWithin usa o índice stations_location_geography_idx.
          sql`ST_DWithin(${location}, ${origin}, ${query.radius})`,
        ),
      )
      .groupBy(stations.id, municipalities.code)
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
    const rows = await this.selectStations()
      .where(and(eq(stations.id, id), eq(stations.active, true)))
      .groupBy(stations.id, municipalities.code);
    if (rows.length === 0) throw new NotFoundException('Posto não encontrado.');

    const [station] = await this.enrich(rows);
    return station;
  }

  /** Cidades da UF que têm postos ativos, em ordem alfabética (ADR 0014). */
  async findCities(state: string): Promise<CityWithStations[]> {
    const rows = await this.db
      .select({
        code: municipalities.code,
        name: municipalities.name,
        state: municipalities.state,
        stations: count(stations.id),
      })
      .from(municipalities)
      .innerJoin(
        stations,
        and(
          eq(stations.municipalityCode, municipalities.code),
          eq(stations.active, true),
        ),
      )
      .where(eq(municipalities.state, state))
      .groupBy(municipalities.code)
      .orderBy(asc(municipalities.name));
    return rows as CityWithStations[];
  }

  /**
   * Postos ativos de uma cidade, com preços e IQP. Com combustível, os mais
   * baratos primeiro (sem preço no fim); sem, por nome. Até CITY_STATIONS_LIMIT.
   */
  async findByMunicipality(query: CityStationsQuery): Promise<CityStations> {
    const [municipality] = await this.db
      .select({
        code: municipalities.code,
        name: municipalities.name,
        state: municipalities.state,
      })
      .from(municipalities)
      .where(eq(municipalities.code, query.municipality));
    if (!municipality) {
      throw new NotFoundException('Município não encontrado.');
    }

    const rows = await this.selectStations()
      .where(
        and(
          eq(stations.municipalityCode, query.municipality),
          eq(stations.active, true),
        ),
      )
      .groupBy(stations.id, municipalities.code);
    const all = await this.enrich(rows);

    const located = all.flatMap((s) => (s.location ? [s.location] : []));
    const center =
      located.length > 0
        ? {
            lat: located.reduce((sum, l) => sum + l.lat, 0) / located.length,
            lng: located.reduce((sum, l) => sum + l.lng, 0) / located.length,
          }
        : null;

    return {
      municipality: municipality as Municipality,
      center,
      total: all.length,
      stations: sortStations(all, query.fuel).slice(0, CITY_STATIONS_LIMIT),
    };
  }

  private selectStations() {
    return this.db
      .select(stationColumns)
      .from(stations)
      .leftJoin(stationFuels, eq(stationFuels.stationId, stations.id))
      .leftJoin(
        municipalities,
        eq(municipalities.code, stations.municipalityCode),
      );
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
      city: row.municipalityName ?? cityDisplayName(row.city),
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

function sortStations(list: Station[], fuel?: FuelType): Station[] {
  const priceOf = (station: Station) =>
    fuel
      ? (station.prices.find((p) => p.fuelType === fuel)?.price ?? Infinity)
      : Infinity;
  return [...list].sort(
    (a, b) => priceOf(a) - priceOf(b) || a.name.localeCompare(b.name, 'pt-BR'),
  );
}
