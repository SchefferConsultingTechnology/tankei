import { z } from 'zod';
import { nullable } from './validation';

/**
 * Critérios do Índice de Qualidade do Posto (IQP). Metodologia: docs/adr/0004-metodologia-iqp-v1.md.
 * O cálculo (pesos incluídos) acontece só no backend; os clientes apenas exibem o resultado.
 * Preço não entra no IQP — tem indicador próprio.
 */

/** Critérios avaliados com nota de 1 a 5. */
export const IQP_RATED_CRITERIA = [
  'atendimento',
  'limpeza',
  'banheiro',
  'calibrador',
  'conveniencia',
  'seguranca',
  'formas_pagamento',
] as const;

/** Critérios de sim/não. */
export const IQP_YES_NO_CRITERIA = ['preco_conforme'] as const;

export const IQP_CRITERIA = [
  ...IQP_RATED_CRITERIA,
  ...IQP_YES_NO_CRITERIA,
] as const;

export type IqpRatedCriterion = (typeof IQP_RATED_CRITERIA)[number];
export type IqpYesNoCriterion = (typeof IQP_YES_NO_CRITERIA)[number];
export type IqpCriterion = (typeof IQP_CRITERIA)[number];

/** Nota de 1 a 5, ou null quando o item não existe no posto ("não disponível"). */
export type CriterionRating = 1 | 2 | 3 | 4 | 5 | null;

export const IQP_CRITERION_LABELS: Record<IqpCriterion, string> = {
  atendimento: 'Atendimento',
  limpeza: 'Limpeza',
  banheiro: 'Banheiro',
  calibrador: 'Calibrador',
  conveniencia: 'Loja de conveniência',
  seguranca: 'Segurança',
  formas_pagamento: 'Formas de pagamento',
  preco_conforme: 'O preço na bomba era o anunciado?',
};

export const IQP_DIMENSIONS = [
  'atendimento_agilidade',
  'limpeza_infraestrutura',
  'transparencia',
  'servicos_conveniencia',
  'seguranca',
] as const;

export type IqpDimension = (typeof IQP_DIMENSIONS)[number];

/** Agrupamento usado para montar a tela de avaliação e exibir a nota por dimensão. */
export const IQP_DIMENSION_CRITERIA: Record<
  IqpDimension,
  readonly IqpCriterion[]
> = {
  atendimento_agilidade: ['atendimento'],
  limpeza_infraestrutura: ['limpeza', 'banheiro'],
  transparencia: ['preco_conforme'],
  servicos_conveniencia: ['calibrador', 'conveniencia', 'formas_pagamento'],
  seguranca: ['seguranca'],
};

export const IQP_DIMENSION_LABELS: Record<IqpDimension, string> = {
  atendimento_agilidade: 'Atendimento e agilidade',
  limpeza_infraestrutura: 'Limpeza e infraestrutura',
  transparencia: 'Transparência',
  servicos_conveniencia: 'Serviços e conveniência',
  seguranca: 'Segurança',
};

export const IQP_METHODOLOGY_VERSION = '1.0.0';

export const IQP_CONFIDENCE_LEVELS = ['baixa', 'media', 'alta'] as const;
export type IqpConfidence = (typeof IQP_CONFIDENCE_LEVELS)[number];

const rating = z
  .number({ error: 'Nota inválida.' })
  .int('Nota inválida.')
  .min(1, 'Nota inválida.')
  .max(5, 'Nota inválida.')
  .nullable()
  .optional();

/**
 * Avaliação de um posto. Em cada critério: nota de 1 a 5, `null` para "não
 * disponível" (o posto não tem o item) ou ausente para "não avaliei".
 */
export const reviewRequestSchema = z
  .object({
    ratings: z
      .object(
        Object.fromEntries(
          IQP_RATED_CRITERIA.map((c) => [c, rating]),
        ) as Record<IqpRatedCriterion, typeof rating>,
      )
      .default({}),
    priceAsAdvertised: z
      .boolean({ error: 'Resposta inválida.' })
      .nullable()
      .optional()
      .describe(
        'O preço na bomba era o anunciado? null quando a pessoa não sabe ou não abasteceu.',
      ),
  })
  .refine(
    (review) =>
      Object.values(review.ratings).some(
        (value) => typeof value === 'number',
      ) || typeof review.priceAsAdvertised === 'boolean',
    { message: 'Avalie ao menos um item.' },
  );
export type ReviewRequest = z.output<typeof reviewRequestSchema>;

export const reviewResponseSchema = z.object({
  id: z.uuid(),
  message: z.string(),
});
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

/** Resumo do IQP exibido na lista de postos. */
export const iqpSummarySchema = z.object({
  score: nullable(
    z.number().int().min(0).max(100),
    'Nota de 0 a 100. Nula com "Dados insuficientes".',
  ),
  confidence: nullable(
    z.enum(IQP_CONFIDENCE_LEVELS),
    'Confiança da nota, separada da qualidade. Nula com "Dados insuficientes".',
  ),
  reviewers: z.number().int().describe('Pessoas que avaliaram o posto.'),
});
export type IqpSummary = z.infer<typeof iqpSummarySchema>;

/** IQP com a nota de cada dimensão, para a ficha do posto. */
export const stationIqpSchema = iqpSummarySchema.extend({
  methodologyVersion: z.string(),
  computedAt: nullable(z.iso.datetime(), 'Momento do último cálculo.'),
  dimensions: z.array(
    z.object({
      dimension: z.enum(IQP_DIMENSIONS),
      label: z.string(),
      score: nullable(
        z.number().int().min(0).max(100),
        'Nula quando ninguém avaliou os itens da dimensão ou com "Dados insuficientes".',
      ),
      weight: z.number().describe('Peso na nota, em %.'),
    }),
  ),
});
export type StationIqp = z.infer<typeof stationIqpSchema>;
