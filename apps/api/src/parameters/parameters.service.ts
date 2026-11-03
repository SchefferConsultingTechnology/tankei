import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  PARAMETER_DEFINITIONS,
  PARAMETER_KEYS,
  type ParameterKey,
  type ParameterValue,
} from '@tankei/shared';
import { desc } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { parameters } from '../database/schema';

const CACHE_TTL_MS = 60_000;

/**
 * Valores vigentes dos parâmetros de regras de negócio (ADR 0006).
 * Alterações valem em até um minuto, sem deploy.
 */
@Injectable()
export class ParametersService implements OnApplicationBootstrap {
  private cache?: { values: Map<string, unknown>; loadedAt: number };

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Falha na subida da API se algum parâmetro não tiver valor no banco. */
  async onApplicationBootstrap(): Promise<void> {
    const values = await this.load();
    const missing = PARAMETER_KEYS.filter((key) => !values.has(key));
    if (missing.length > 0) {
      throw new Error(
        `Parâmetros sem valor no banco: ${missing.join(', ')}. Rode pnpm db:migrate.`,
      );
    }
  }

  async get<K extends ParameterKey>(key: K): Promise<ParameterValue<K>> {
    const values = await this.load();
    if (!values.has(key)) {
      throw new Error(`Parâmetro sem valor no banco: ${key}`);
    }
    return PARAMETER_DEFINITIONS[key].schema.parse(
      values.get(key),
    ) as ParameterValue<K>;
  }

  /** Registra um novo valor. O anterior continua no histórico. */
  async set<K extends ParameterKey>(
    key: K,
    value: ParameterValue<K>,
    reason: string,
    changedByUserId?: string,
  ): Promise<void> {
    const parsed = PARAMETER_DEFINITIONS[key].schema.parse(value);
    await this.db
      .insert(parameters)
      .values({ key, value: parsed, reason, changedByUserId });
    this.cache = undefined;
  }

  private async load(): Promise<Map<string, unknown>> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.values;
    }
    const rows = await this.db
      .selectDistinctOn([parameters.key], {
        key: parameters.key,
        value: parameters.value,
      })
      .from(parameters)
      .orderBy(parameters.key, desc(parameters.createdAt));

    const values = new Map(rows.map((row) => [row.key, row.value]));
    this.cache = { values, loadedAt: Date.now() };
    return values;
  }
}
