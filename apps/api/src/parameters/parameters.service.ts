import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  PARAMETER_DEFINITIONS,
  PARAMETER_KEYS,
  parameterGroup,
  type AdminParameter,
  type ParameterChange,
  type ParameterKey,
  type ParameterValue,
  type UpdateParameter,
} from '@tankei/shared';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { parameters, users } from '../database/schema';

const CACHE_TTL_MS = 60_000;

/** Pares em que um valor não pode passar do outro. */
const PAIR_RULES: { low: ParameterKey; high: ParameterKey; message: string }[] =
  [
    {
      low: 'price.reference_normal_pct',
      high: 'price.reference_max_pct',
      message:
        'A distância normal da média ANP não pode passar da distância máxima.',
    },
    {
      low: 'price.stale_after_days',
      high: 'price.hide_after_days',
      message:
        'O preço precisa ficar desatualizado antes (ou no mesmo dia) de deixar de ser exibido.',
    },
  ];

function toChange(row: {
  value: unknown;
  reason: string;
  createdAt: Date;
  name: string | null;
  email: string | null;
}): ParameterChange {
  return {
    value: Number(row.value),
    reason: row.reason,
    changedBy: row.name ?? row.email,
    changedAt: row.createdAt.toISOString(),
  };
}

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

  // ---------- Administração ----------

  /** Todos os parâmetros com o valor vigente e a última alteração. */
  async adminList(): Promise<AdminParameter[]> {
    const rows = await this.historyRows();
    return PARAMETER_KEYS.flatMap((key) => {
      const changes = rows.filter((row) => row.key === key);
      if (changes.length === 0) return [];
      const [latest] = changes;
      const definition = PARAMETER_DEFINITIONS[key];
      return [
        {
          key,
          group: parameterGroup(key),
          label: definition.label,
          description: definition.description,
          unit: definition.unit,
          ...toChange(latest),
          changes: changes.length,
        },
      ];
    });
  }

  /** Alterações de um parâmetro, as mais recentes primeiro. */
  async history(key: string): Promise<ParameterChange[]> {
    const parameterKey = this.assertKey(key);
    const rows = await this.historyRows(parameterKey);
    return rows.map(toChange);
  }

  /**
   * Alteração pelo administrador: valida a unidade e a coerência com o
   * parâmetro par (ex.: limite normal não passa do máximo). Vale em até um
   * minuto nas outras instâncias (cache).
   */
  async adminSet(
    key: string,
    body: UpdateParameter,
    adminId: string,
  ): Promise<AdminParameter> {
    const parameterKey = this.assertKey(key);
    const definition = PARAMETER_DEFINITIONS[parameterKey];
    if (!definition.schema.safeParse(body.value).success) {
      if (definition.unit === 'percent') {
        throw new BadRequestException('Use um valor entre 0 e 100.');
      }
      const min = [0, 1, 2].find((v) => definition.schema.safeParse(v).success);
      throw new BadRequestException(
        min === 1
          ? 'Use um número inteiro maior que zero.'
          : `Use um número inteiro a partir de ${min ?? 0}.`,
      );
    }
    this.cache = undefined;
    for (const rule of PAIR_RULES) {
      if (rule.low !== parameterKey && rule.high !== parameterKey) continue;
      const low =
        rule.low === parameterKey ? body.value : await this.get(rule.low);
      const high =
        rule.high === parameterKey ? body.value : await this.get(rule.high);
      if (low > high) throw new BadRequestException(rule.message);
    }

    await this.set(parameterKey, body.value, body.reason, adminId);
    const updated = (await this.adminList()).find(
      (p) => p.key === parameterKey,
    );
    if (!updated) throw new NotFoundException('Parâmetro não encontrado.');
    return updated;
  }

  private assertKey(key: string): ParameterKey {
    if (!(PARAMETER_KEYS as string[]).includes(key)) {
      throw new NotFoundException('Parâmetro não encontrado.');
    }
    return key as ParameterKey;
  }

  private historyRows(key?: ParameterKey) {
    return this.db
      .select({
        key: parameters.key,
        value: parameters.value,
        reason: parameters.reason,
        createdAt: parameters.createdAt,
        name: users.name,
        email: users.email,
      })
      .from(parameters)
      .leftJoin(users, eq(users.id, parameters.changedByUserId))
      .where(key ? eq(parameters.key, key) : undefined)
      .orderBy(parameters.key, desc(parameters.createdAt));
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
