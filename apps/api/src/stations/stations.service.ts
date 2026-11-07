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
  type StationMode,
} from '@tankei/shared';
import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  municipalities,
  organizationStations,
  promotions,
  stationFuels,
  stations,
} from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { PriceReportsService } from '../prices/price-reports.service';
import { AgreementsService } from '../agreements/agreements.service';
import { StationInfoService } from '../station-info/station-info.service';
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
  displayName: stations.displayName,
  brand: stations.brand,
  address: stations.address,
  district: stations.district,
  city: stations.city,
  municipalityName: municipalities.name,
  state: stations.state,
  location: stations.location,
  displayMode: stations.displayMode,
  // text[] porque o driver pg não converte arrays de enum.
  fuels: sql<
    FuelType[]
  >`coalesce(array_agg(${stationFuels.fuelType}::text order by ${stationFuels.fuelType}) filter (where ${stationFuels.fuelType} is not null), '{}')`,
};

/** Ativo na ANP e não oculto pela administração (ADR 0028). */
function visibleStation() {
  return and(eq(stations.active, true), ne(stations.displayMode, 'oculto'));
}

interface StationRow {
  id: string;
  legalName: string;
  tradeName: string | null;
  displayName: string | null;
  brand: string;
  address: string;
  district: string | null;
  city: string;
  municipalityName: string | null;
  state: string;
  location: { x: number; y: number } | null;
  displayMode: StationMode;
  fuels: FuelType[];
}

@Injectable()
export class StationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly priceReports: PriceReportsService,
    private readonly iqp: IqpService,
    private readonly stationInfo: StationInfoService,
    private readonly agreements: AgreementsService,
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
          visibleStation(),
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
      .where(and(eq(stations.id, id), visibleStation()))
      .groupBy(stations.id, municipalities.code);
    if (rows.length === 0) throw new NotFoundException('Posto não encontrado.');

    const [station] = await this.enrich(rows);
    return station;
  }

  /** Postos visíveis pelos ids, com preços e IQP, na ordem pedida. */
  async findByIds(ids: string[]): Promise<Station[]> {
    if (ids.length === 0) return [];
    const rows = await this.selectStations()
      .where(and(inArray(stations.id, ids), visibleStation()))
      .groupBy(stations.id, municipalities.code);
    const enriched = await this.enrich(rows);
    return ids.flatMap((id) => enriched.filter((s) => s.id === id));
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
          visibleStation(),
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
          visibleStation(),
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
    const now = new Date();
    const [
      prices,
      iqpScores,
      promotionRows,
      managedRows,
      info,
      agreementsByStation,
    ] = await Promise.all([
      this.priceReports.currentPrices(ids, now),
      this.iqp.latest(ids),
      // Promoções vigentes (ADR 0026): começaram e não terminaram nem foram
      // encerradas antes.
      // inArray com lista vazia vira "false" no Drizzle.
      this.db
        .select({
          id: promotions.id,
          stationId: promotions.stationId,
          title: promotions.title,
          endsAt: promotions.endsAt,
          endedAt: promotions.endedAt,
        })
        .from(promotions)
        .where(
          and(
            inArray(promotions.stationId, ids),
            lte(promotions.startsAt, now),
            gt(promotions.endsAt, now),
            or(isNull(promotions.endedAt), gt(promotions.endedAt, now)),
          ),
        )
        .orderBy(asc(promotions.endsAt)),
      // Postos já com rede no portal (ADR 0031).
      this.db
        .select({ stationId: organizationStations.stationId })
        .from(organizationStations)
        .where(inArray(organizationStations.stationId, ids)),
      this.stationInfo.current(ids),
      this.agreements.current(ids),
    ]);
    const managed = new Set(managedRows.map((r) => r.stationId));

    return rows.map((row) => ({
      id: row.id,
      name: stationDisplayName(row.tradeName, row.legalName, row.displayName),
      brand: brandDisplayName(row.brand),
      address: row.address,
      district: row.district,
      city: row.municipalityName ?? cityDisplayName(row.city),
      state: row.state,
      location: row.location
        ? { lat: row.location.y, lng: row.location.x }
        : null,
      fuels: row.fuels,
      // Preços ocultos (ADR 0028): sem preços nem promoções no app.
      prices:
        row.displayMode === 'precos_ocultos' ? [] : (prices.get(row.id) ?? []),
      mode: row.displayMode === 'oculto' ? 'normal' : row.displayMode,
      iqp: this.iqp.summary(iqpScores.get(row.id)),
      managed: managed.has(row.id),
      hours: info.get(row.id)?.hours ?? null,
      services: info.get(row.id)?.services ?? [],
      // Preços ocultos (ADR 0028): sem convênios também.
      agreements:
        row.displayMode === 'precos_ocultos'
          ? []
          : (agreementsByStation.get(row.id) ?? []),
      activePromotions: promotionRows
        .filter(
          (p) => p.stationId === row.id && row.displayMode !== 'precos_ocultos',
        )
        .map((p) => ({
          id: p.id,
          title: p.title,
          endsAt: (p.endedAt && p.endedAt < p.endsAt
            ? p.endedAt
            : p.endsAt
          ).toISOString(),
        })),
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
