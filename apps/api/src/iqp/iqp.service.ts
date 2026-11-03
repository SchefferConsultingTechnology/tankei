import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  IQP_DIMENSION_LABELS,
  IQP_DIMENSIONS,
  type IqpSummary,
  type StationIqp,
} from '@tankei/shared';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { iqpScores, reviews, stations } from '../database/schema';
import {
  computeCityPrior,
  computeIqp,
  METHODOLOGY_V1,
  type ReviewInput,
} from './methodology-v1';

type ScoreRow = typeof iqpScores.$inferSelect;

/** Cálculo e consulta do IQP (ADR 0004). Só o backend calcula a nota. */
@Injectable()
export class IqpService {
  private readonly logger = new Logger(IqpService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // O decaimento e a média da cidade mudam a nota mesmo sem avaliações novas.
  @Cron(process.env.IQP_RECALC_CRON ?? '30 3 * * *', {
    name: 'iqp-recalc',
    timeZone: 'America/Sao_Paulo',
  })
  async recomputeAgendado(): Promise<void> {
    try {
      const total = await this.recompute();
      this.logger.log(`IQP recalculado para ${total} posto(s).`);
    } catch (error) {
      this.logger.error('Falha ao recalcular o IQP', error);
    }
  }

  /**
   * Recalcula e registra o IQP dos postos informados, ou de todos os postos
   * avaliados. A média de cada cidade usa todas as avaliações da cidade.
   */
  async recompute(stationIds?: string[], now = new Date()): Promise<number> {
    const cityOf = sql`(${stations.state}, ${stations.city})`;
    const targetCities = stationIds
      ? sql`${cityOf} in (select state, city from stations where id in ${stationIds})`
      : sql`true`;

    const rows = await this.db
      .select({
        stationId: reviews.stationId,
        userId: reviews.userId,
        answers: reviews.answers,
        createdAt: reviews.createdAt,
        city: sql<string>`${stations.state} || '|' || ${stations.city}`,
      })
      .from(reviews)
      .innerJoin(stations, eq(stations.id, reviews.stationId))
      .where(targetCities);

    const byCity = groupBy(rows, (row) => row.city);
    const targets = new Set(stationIds ?? rows.map((row) => row.stationId));
    const scores: (typeof iqpScores.$inferInsert)[] = [];

    for (const cityReviews of byCity.values()) {
      const prior = computeCityPrior(cityReviews, now);
      const byStation = groupBy<ReviewInput>(cityReviews, (r) => r.stationId);
      for (const [stationId, stationReviews] of byStation) {
        if (!targets.has(stationId)) continue;
        const result = computeIqp(stationReviews, prior, now);
        scores.push({
          stationId,
          methodologyVersion: METHODOLOGY_V1.version,
          ...result,
          computedAt: now,
        });
      }
    }

    if (scores.length > 0) await this.db.insert(iqpScores).values(scores);
    return scores.length;
  }

  /** Último cálculo de cada posto. */
  async latest(stationIds: string[]): Promise<Map<string, ScoreRow>> {
    if (stationIds.length === 0) return new Map();
    const rows = await this.db
      .selectDistinctOn([iqpScores.stationId])
      .from(iqpScores)
      .where(inArray(iqpScores.stationId, stationIds))
      .orderBy(iqpScores.stationId, desc(iqpScores.computedAt));
    return new Map(rows.map((row) => [row.stationId, row]));
  }

  summary(row: ScoreRow | undefined): IqpSummary {
    return {
      score: row?.score == null ? null : Math.round(row.score),
      confidence: row?.confidence ?? null,
      reviewers: row?.reviewers ?? 0,
    };
  }

  async detail(stationId: string): Promise<StationIqp> {
    const row = (await this.latest([stationId])).get(stationId);
    const sufficient = row?.score != null;
    return {
      ...this.summary(row),
      methodologyVersion: row?.methodologyVersion ?? METHODOLOGY_V1.version,
      computedAt: row?.computedAt.toISOString() ?? null,
      dimensions: IQP_DIMENSIONS.map((dimension) => {
        const result = row?.dimensions[dimension];
        return {
          dimension,
          label: IQP_DIMENSION_LABELS[dimension],
          // Com "Dados insuficientes", as notas por dimensão também não aparecem.
          score:
            sufficient && result?.score != null
              ? Math.round(result.score)
              : null,
          weight: result?.weight ?? METHODOLOGY_V1.weights[dimension],
        };
      }),
    };
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}
