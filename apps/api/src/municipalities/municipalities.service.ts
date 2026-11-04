import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { municipalities, stations } from '../database/schema';
import {
  MunicipalityMatcher,
  normalizeMunicipalityName,
} from './municipality-matcher';

/** API de localidades do IBGE (pública, sem autenticação). */
const IBGE_MUNICIPALITIES_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado';
const TIMEOUT_MS = 60_000;
const BATCH_SIZE = 1000;

interface IbgeMunicipality {
  'municipio-id': number;
  'municipio-nome': string;
  'UF-sigla': string;
}

export interface IbgeImportResult {
  municipios: number;
  postosLigados: number;
  /** Cidades da ANP sem município correspondente (para revisar a tabela de grafias). */
  semMunicipio: string[];
}

@Injectable()
export class MunicipalitiesService {
  private readonly logger = new Logger(MunicipalitiesService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Importa a lista oficial do IBGE e liga os postos ainda sem município. */
  async importFromIbge(): Promise<IbgeImportResult> {
    const response = await fetch(IBGE_MUNICIPALITIES_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`IBGE respondeu ${response.status}`);
    }
    const list = (await response.json()) as IbgeMunicipality[];
    const rows = list.map((m) => ({
      code: String(m['municipio-id']),
      name: m['municipio-nome'],
      state: m['UF-sigla'],
      normalizedName: normalizeMunicipalityName(m['municipio-nome']),
    }));

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await this.db
        .insert(municipalities)
        .values(rows.slice(i, i + BATCH_SIZE))
        .onConflictDoUpdate({
          target: municipalities.code,
          set: {
            name: sql.raw('excluded."name"'),
            state: sql.raw('excluded."state"'),
            normalizedName: sql.raw('excluded."normalized_name"'),
          },
        });
    }

    const result = { municipios: rows.length, ...(await this.linkStations()) };
    this.logger.log(
      `IBGE: ${result.municipios} municípios, ${result.postosLigados} postos ligados, ` +
        `${result.semMunicipio.length} cidade(s) da ANP sem correspondência`,
    );
    return result;
  }

  /** Casamento de nomes com os municípios já importados. */
  async matcher(): Promise<MunicipalityMatcher> {
    const rows = await this.db
      .select({
        code: municipalities.code,
        state: municipalities.state,
        normalizedName: municipalities.normalizedName,
      })
      .from(municipalities);
    return new MunicipalityMatcher(rows);
  }

  /** Liga ao município os postos que ainda não têm, cidade a cidade. */
  private async linkStations(): Promise<Omit<IbgeImportResult, 'municipios'>> {
    const matcher = await this.matcher();
    const cities = await this.db
      .selectDistinct({ state: stations.state, city: stations.city })
      .from(stations)
      .where(isNull(stations.municipalityCode));

    let postosLigados = 0;
    const semMunicipio: string[] = [];
    for (const { state, city } of cities) {
      const code = matcher.match(state, city);
      if (!code) {
        semMunicipio.push(`${state}/${city}`);
        continue;
      }
      const updated = await this.db
        .update(stations)
        .set({ municipalityCode: code })
        .where(
          and(
            eq(stations.state, state),
            eq(stations.city, city),
            isNull(stations.municipalityCode),
          ),
        )
        .returning({ id: stations.id });
      postosLigados += updated.length;
    }
    return { postosLigados, semMunicipio };
  }
}
