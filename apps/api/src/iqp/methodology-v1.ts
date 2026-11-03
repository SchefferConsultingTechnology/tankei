import {
  IQP_CRITERIA,
  IQP_DIMENSION_CRITERIA,
  IQP_DIMENSIONS,
  IQP_RATED_CRITERIA,
  type IqpConfidence,
  type IqpCriterion,
} from '@tankei/shared';
import type {
  IqpDimensionResult,
  ReviewAnswers,
} from '../database/schema/reviews';

/**
 * Metodologia do IQP, versão 1.0.0 (ADR 0004). Estes números fazem parte da
 * metodologia versionada, não dos parâmetros (ADR 0006): mudar qualquer um
 * deles exige uma nova versão.
 */
export const METHODOLOGY_V1 = {
  version: '1.0.0',
  /** Peso de cada dimensão, em %. */
  weights: {
    atendimento_agilidade: 30,
    limpeza_infraestrutura: 25,
    transparencia: 20,
    servicos_conveniencia: 15,
    seguranca: 10,
  },
  /** Avaliações "fictícias" com a média da cidade, somadas a cada critério. */
  priorWeight: 5,
  /** Uma avaliação perde metade do peso a cada tantos dias. */
  halfLifeDays: 180,
  /** Pessoas diferentes para exibir a nota. */
  minReviewers: 3,
  /** Média usada quando a cidade ainda não tem avaliações (3 estrelas). */
  neutralScore: 50,
  /** Avaliações efetivas: abaixo de `media` é baixa; acima de `alta`, alta. */
  confidence: { media: 5, alta: 15 },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const RATED = new Set<IqpCriterion>(IQP_RATED_CRITERIA);

export interface ReviewInput {
  stationId: string;
  userId: string;
  createdAt: Date;
  answers: ReviewAnswers;
}

/** Média de cada critério na cidade, de 0 a 100. Critério ausente usa o neutro. */
export type CityPrior = Partial<Record<IqpCriterion, number>>;

export interface IqpResult {
  /** De 0 a 100, com duas casas. Nula abaixo do mínimo de pessoas. */
  score: number | null;
  confidence: IqpConfidence | null;
  reviewers: number;
  effectiveReviews: number;
  dimensions: IqpDimensionResult;
}

/** Média ponderada de cada critério em todas as avaliações da cidade. */
export function computeCityPrior(
  cityReviews: ReviewInput[],
  now: Date,
): CityPrior {
  const latest = latestPerPerson(cityReviews);
  const prior: CityPrior = {};
  for (const criterion of IQP_CRITERIA) {
    const weighted = weightedAnswers(latest, criterion, now);
    if (weighted.totalWeight > 0) {
      prior[criterion] = weighted.sum / weighted.totalWeight;
    }
  }
  return prior;
}

/** IQP de um posto a partir das avaliações dele e da média da cidade. */
export function computeIqp(
  stationReviews: ReviewInput[],
  prior: CityPrior,
  now: Date,
): IqpResult {
  const m = METHODOLOGY_V1;
  const latest = latestPerPerson(stationReviews).filter(hasAnswer);
  const effectiveReviews = round(
    latest.reduce((total, review) => total + decay(review, now), 0),
    3,
  );

  // Nota de cada critério, puxada para a média da cidade enquanto há poucas avaliações.
  const criterionScores = new Map<IqpCriterion, number>();
  for (const criterion of IQP_CRITERIA) {
    const weighted = weightedAnswers(latest, criterion, now);
    if (weighted.totalWeight === 0) continue; // ninguém avaliou: não disponível
    const cityMean = prior[criterion] ?? m.neutralScore;
    criterionScores.set(
      criterion,
      (m.priorWeight * cityMean + weighted.sum) /
        (m.priorWeight + weighted.totalWeight),
    );
  }

  const dimensions = {} as IqpDimensionResult;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const dimension of IQP_DIMENSIONS) {
    const scores = IQP_DIMENSION_CRITERIA[dimension]
      .map((criterion) => criterionScores.get(criterion))
      .filter((score): score is number => score !== undefined);
    const weight = m.weights[dimension];
    const score = scores.length > 0 ? average(scores) : null;
    dimensions[dimension] = {
      score: score === null ? null : round(score, 2),
      weight,
    };
    if (score !== null) {
      // Dimensão sem dados fica de fora: seu peso se redistribui.
      weightedSum += score * weight;
      weightTotal += weight;
    }
  }

  const enough = latest.length >= m.minReviewers && weightTotal > 0;
  return {
    score: enough ? round(weightedSum / weightTotal, 2) : null,
    confidence: enough ? confidenceFor(effectiveReviews) : null,
    reviewers: latest.length,
    effectiveReviews,
    dimensions,
  };
}

function confidenceFor(effectiveReviews: number): IqpConfidence {
  const { media, alta } = METHODOLOGY_V1.confidence;
  if (effectiveReviews < media) return 'baixa';
  if (effectiveReviews <= alta) return 'media';
  return 'alta';
}

/** Só a avaliação mais recente de cada pessoa em cada posto conta. */
function latestPerPerson(reviews: ReviewInput[]): ReviewInput[] {
  const latest = new Map<string, ReviewInput>();
  for (const review of reviews) {
    const key = `${review.stationId}|${review.userId}`;
    const current = latest.get(key);
    if (!current || review.createdAt > current.createdAt) {
      latest.set(key, review);
    }
  }
  return [...latest.values()];
}

function hasAnswer(review: ReviewInput): boolean {
  return Object.values(review.answers).some(
    (value) => value !== null && value !== undefined,
  );
}

/** Peso pela idade: metade a cada `halfLifeDays`. */
function decay(review: ReviewInput, now: Date): number {
  const ageDays = Math.max(
    0,
    (now.getTime() - review.createdAt.getTime()) / DAY_MS,
  );
  return 0.5 ** (ageDays / METHODOLOGY_V1.halfLifeDays);
}

function weightedAnswers(
  reviews: ReviewInput[],
  criterion: IqpCriterion,
  now: Date,
): { sum: number; totalWeight: number } {
  let sum = 0;
  let totalWeight = 0;
  for (const review of reviews) {
    const value = toScale(criterion, review.answers[criterion]);
    if (value === null) continue;
    const weight = decay(review, now);
    sum += value * weight;
    totalWeight += weight;
  }
  return { sum, totalWeight };
}

/** Nota de 1 a 5 vira 0 a 100; sim/não vira 100/0; "não disponível" é null. */
function toScale(
  criterion: IqpCriterion,
  value: number | boolean | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (RATED.has(criterion)) {
    return ((Number(value) - 1) / 4) * 100;
  }
  return value === true ? 100 : 0;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
