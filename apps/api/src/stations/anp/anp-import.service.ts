import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { stationFuels, stations } from '../../database/schema';
import { mapAnpStation, type StationFromAnp } from './anp-mapping';
import {
  AnpRevendedoresClient,
  type AnpFiltro,
} from './anp-revendedores.client';

export interface AnpImportResult {
  recebidos: number;
  novos: number;
  atualizados: number;
  /** Postos sem combustível automotivo (por exemplo, só aviação). */
  ignorados: number;
  semCoordenada: number;
}

/** Postos por instrução: ~12 parâmetros por posto, bem abaixo do limite do PostgreSQL. */
const BATCH_SIZE = 500;

/** Valor proposto na linha que entrou em conflito (INSERT ... ON CONFLICT). */
const excluded = (column: string) => sql.raw(`excluded."${column}"`);

/**
 * Importa postos da API Revendedores da ANP: um município, uma UF ou o Brasil.
 * Pode rodar várias vezes: atualiza pelo CNPJ, sem duplicar.
 */
@Injectable()
export class AnpImportService {
  private readonly logger = new Logger(AnpImportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly anp: AnpRevendedoresClient,
  ) {}

  async importar(filtro: AnpFiltro = {}): Promise<AnpImportResult> {
    const postos = await this.anp.listarPostos(filtro);
    const mapped = postos.map(mapAnpStation);
    // Um CNPJ repetido no mesmo lote faria o upsert alterar a mesma linha duas vezes.
    const byCnpj = new Map<string, StationFromAnp>();
    for (const station of mapped)
      if (station) byCnpj.set(station.cnpj, station);
    const unique = [...byCnpj.values()];

    const result: AnpImportResult = {
      recebidos: postos.length,
      novos: 0,
      atualizados: 0,
      ignorados: mapped.filter((station) => !station).length,
      semCoordenada: unique.filter((station) => !station.location).length,
    };

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < unique.length; i += BATCH_SIZE) {
        const batch = unique.slice(i, i + BATCH_SIZE);
        const saved = await tx
          .insert(stations)
          .values(
            batch.map((station) => ({
              ...cadastro(station),
              location: pointSql(station.location),
              locationSource: station.location ? ('anp' as const) : null,
            })),
          )
          .onConflictDoUpdate({
            target: stations.cnpj,
            set: {
              anpAuthorization: excluded('anp_authorization'),
              legalName: excluded('legal_name'),
              brand: excluded('brand'),
              address: excluded('address'),
              complement: excluded('complement'),
              district: excluded('district'),
              postalCode: excluded('postal_code'),
              city: excluded('city'),
              state: excluded('state'),
              // A coordenada da ANP só substitui outra que também veio da ANP:
              // geocodificação e conferência em campo têm prioridade.
              location: sql`case when ${stations.locationSource} is null or ${stations.locationSource} = 'anp' then ${excluded('location')} else ${stations.location} end`,
              locationSource: sql`case when ${stations.locationSource} is null or ${stations.locationSource} = 'anp' then ${excluded('location_source')} else ${stations.locationSource} end`,
              updatedAt: new Date(),
            },
          })
          // xmax = 0 só na linha recém-inserida: separa novos de atualizados.
          .returning({
            id: stations.id,
            cnpj: stations.cnpj,
            inserted: sql<boolean>`(xmax = 0)`,
          });

        for (const row of saved) {
          if (row.inserted) result.novos++;
          else result.atualizados++;
        }

        // Só acrescenta: combustíveis informados pelo próprio posto não são removidos.
        const idByCnpj = new Map(saved.map((row) => [row.cnpj, row.id]));
        await tx
          .insert(stationFuels)
          .values(
            batch.flatMap((station) =>
              station.fuels.map((fuelType) => ({
                stationId: idByCnpj.get(station.cnpj)!,
                fuelType,
              })),
            ),
          )
          .onConflictDoNothing();
      }
    });

    this.logger.log(
      `${describe(filtro)}: ${result.recebidos} recebidos, ${result.novos} novos, ` +
        `${result.atualizados} atualizados, ${result.ignorados} ignorados, ` +
        `${result.semCoordenada} sem coordenada`,
    );
    return result;
  }
}

function describe(filtro: AnpFiltro): string {
  if (filtro.municipio) return `${filtro.uf}/${filtro.municipio}`;
  return filtro.uf ?? 'Brasil';
}

function cadastro(station: StationFromAnp) {
  return {
    cnpj: station.cnpj,
    anpAuthorization: station.anpAuthorization,
    legalName: station.legalName,
    brand: station.brand,
    address: station.address,
    complement: station.complement,
    district: station.district,
    postalCode: station.postalCode,
    city: station.city,
    state: station.state,
  };
}

// O Drizzle grava pontos sem SRID; a coluna exige 4326, então montamos o ponto em SQL.
function pointSql(location: StationFromAnp['location']) {
  return location
    ? sql`ST_SetSRID(ST_MakePoint(${location.x}, ${location.y}), 4326)`
    : sql`null`;
}
