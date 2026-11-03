import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { stationFuels, stations } from '../../database/schema';
import { mapAnpStation, type StationFromAnp } from './anp-mapping';
import { AnpRevendedoresClient } from './anp-revendedores.client';

export interface AnpImportResult {
  recebidos: number;
  novos: number;
  atualizados: number;
  /** Postos sem combustível automotivo (por exemplo, só aviação). */
  ignorados: string[];
  semCoordenada: string[];
}

/**
 * Importa os postos de um município a partir da API Revendedores da ANP.
 * Pode rodar várias vezes: atualiza pelo CNPJ, sem duplicar.
 */
@Injectable()
export class AnpImportService {
  private readonly logger = new Logger(AnpImportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly anp: AnpRevendedoresClient,
  ) {}

  async importar(uf: string, municipio: string): Promise<AnpImportResult> {
    const postos = await this.anp.listarPostos(uf, municipio);
    const result: AnpImportResult = {
      recebidos: postos.length,
      novos: 0,
      atualizados: 0,
      ignorados: [],
      semCoordenada: [],
    };

    await this.db.transaction(async (tx) => {
      for (const posto of postos) {
        const station = mapAnpStation(posto);
        if (!station) {
          result.ignorados.push(posto.razaoSocial);
          continue;
        }
        if (!station.location) {
          result.semCoordenada.push(station.legalName);
        }

        const [saved] = await tx
          .insert(stations)
          .values({
            ...cadastro(station),
            location: pointSql(station.location),
            locationSource: station.location ? 'anp' : null,
          })
          .onConflictDoUpdate({
            target: stations.cnpj,
            set: {
              ...cadastro(station),
              // A coordenada da ANP só substitui outra que também veio da ANP:
              // geocodificação e conferência em campo têm prioridade.
              location: sql`case when ${stations.locationSource} is null or ${stations.locationSource} = 'anp' then ${pointSql(station.location)} else ${stations.location} end`,
              locationSource: sql`case when ${stations.locationSource} is null or ${stations.locationSource} = 'anp' then ${station.location ? 'anp' : null}::location_source else ${stations.locationSource} end`,
              updatedAt: new Date(),
            },
          })
          // xmax = 0 só na linha recém-inserida: separa novos de atualizados.
          .returning({ id: stations.id, inserted: sql<boolean>`(xmax = 0)` });

        if (saved.inserted) result.novos++;
        else result.atualizados++;

        // Só acrescenta: combustíveis informados pelo próprio posto não são removidos.
        await tx
          .insert(stationFuels)
          .values(
            station.fuels.map((fuelType) => ({
              stationId: saved.id,
              fuelType,
            })),
          )
          .onConflictDoNothing();
      }
    });

    this.logger.log(
      `${uf}/${municipio}: ${result.recebidos} recebidos, ${result.novos} novos, ` +
        `${result.atualizados} atualizados, ${result.ignorados.length} ignorados, ` +
        `${result.semCoordenada.length} sem coordenada`,
    );
    return result;
  }
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
