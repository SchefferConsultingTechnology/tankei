import { z } from 'zod';

const percent = z.number().min(0).max(100);
const positiveInt = z.number().int().positive();

/**
 * Parâmetros das regras de negócio (ADR 0006). Aqui ficam só a chave, o tipo e
 * a descrição: os valores ficam no banco, com histórico de alterações.
 */
export const PARAMETER_DEFINITIONS = {
  'price.reference_normal_pct': {
    schema: percent,
    description:
      'Distância máxima da referência (%) para o informe ser aceito normalmente.',
  },
  'price.reference_max_pct': {
    schema: percent,
    description:
      'Distância máxima da referência (%) antes de o informe ser rejeitado. Entre o limite normal e este, o informe fica suspeito.',
  },
  'price.variation_confirm_pct': {
    schema: percent,
    description:
      'Variação (%) em relação ao preço vigente do posto que pede confirmação ao usuário.',
  },
  'price.confirmation_window_hours': {
    schema: positiveInt,
    description:
      'Janela (horas) em que informes iguais contam como confirmação.',
  },
  'price.confirmations_required': {
    schema: positiveInt,
    description:
      'Pessoas diferentes que precisam informar o mesmo valor para "Confirmado por motoristas".',
  },
  'price.stale_after_days': {
    schema: positiveInt,
    description: 'Dias sem informe novo até o preço ficar "Desatualizado".',
  },
  'price.hide_after_days': {
    schema: positiveInt,
    description: 'Dias sem informe novo até o preço deixar de ser exibido.',
  },
  'price.report_min_interval_hours': {
    schema: positiveInt,
    description:
      'Intervalo mínimo (horas) entre informes da mesma conta para o mesmo posto e combustível.',
  },
  'price.reports_per_day_max': {
    schema: positiveInt,
    description: 'Máximo de informes de preço por conta por dia.',
  },
  'price.promotion_max_days': {
    schema: positiveInt,
    description:
      'Duração máxima (dias) de um preço promocional informado pelo posto.',
  },
  'review.min_interval_days': {
    schema: positiveInt,
    description:
      'Intervalo mínimo (dias) entre avaliações da mesma conta para o mesmo posto.',
  },
} satisfies Record<string, { schema: z.ZodType; description: string }>;

export type ParameterKey = keyof typeof PARAMETER_DEFINITIONS;

export type ParameterValue<K extends ParameterKey> = z.output<
  (typeof PARAMETER_DEFINITIONS)[K]['schema']
>;

export const PARAMETER_KEYS = Object.keys(
  PARAMETER_DEFINITIONS,
) as ParameterKey[];
