import { z } from 'zod';
import { nullable } from './validation';

const percent = z.number().min(0).max(100);
const positiveInt = z.number().int().positive();

/** Unidade do valor, para exibir e validar no admin. */
export const PARAMETER_UNITS = [
  'percent',
  'hours',
  'days',
  'meters',
  'count',
] as const;
export type ParameterUnit = (typeof PARAMETER_UNITS)[number];

export const PARAMETER_UNIT_LABELS: Record<ParameterUnit, string> = {
  percent: '%',
  hours: 'horas',
  days: 'dias',
  meters: 'm',
  count: '',
};

/** Grupo do parâmetro (prefixo da chave), na ordem do admin. */
export const PARAMETER_GROUP_LABELS: Record<string, string> = {
  price: 'Preços',
  portal: 'Portal do posto',
  claim: 'Pedidos de acesso',
  team: 'Equipe',
  review: 'Avaliações',
};

/**
 * Parâmetros das regras de negócio (ADR 0006). Aqui ficam só a chave, o tipo,
 * o nome e a descrição: os valores ficam no banco, com histórico de alterações.
 */
export const PARAMETER_DEFINITIONS = {
  'price.reference_normal_pct': {
    schema: percent,
    unit: 'percent',
    label: 'Distância normal da média ANP',
    description:
      'Distância máxima da referência (%) para o informe ser aceito normalmente.',
  },
  'price.reference_max_pct': {
    schema: percent,
    unit: 'percent',
    label: 'Distância máxima da média ANP',
    description:
      'Distância máxima da referência (%) antes de o informe ser rejeitado. Entre o limite normal e este, o informe fica suspeito.',
  },
  'price.variation_confirm_pct': {
    schema: percent,
    unit: 'percent',
    label: 'Variação que pede confirmação',
    description:
      'Variação (%) em relação ao preço vigente do posto que pede confirmação a quem informa (consumidor ou posto, inclusive em promoção).',
  },
  'price.confirmation_window_hours': {
    schema: positiveInt,
    unit: 'hours',
    label: 'Janela de confirmação',
    description:
      'Janela (horas) em que informes iguais contam como confirmação.',
  },
  'price.confirmations_required': {
    schema: positiveInt,
    unit: 'count',
    label: 'Pessoas para confirmar',
    description:
      'Pessoas diferentes que precisam informar o mesmo valor para "Confirmado por consumidores".',
  },
  'price.stale_after_days': {
    schema: positiveInt,
    unit: 'days',
    label: 'Preço desatualizado após',
    description: 'Dias sem informe novo até o preço ficar "Desatualizado".',
  },
  'price.hide_after_days': {
    schema: positiveInt,
    unit: 'days',
    label: 'Preço oculto após',
    description: 'Dias sem informe novo até o preço deixar de ser exibido.',
  },
  'price.report_min_interval_hours': {
    schema: positiveInt,
    unit: 'hours',
    label: 'Intervalo entre informes',
    description:
      'Intervalo mínimo (horas) entre informes da mesma conta para o mesmo posto e combustível.',
  },
  'price.reports_per_day_max': {
    schema: positiveInt,
    unit: 'count',
    label: 'Informes por dia',
    description: 'Máximo de informes de preço por conta por dia.',
  },
  'price.promotion_max_days': {
    schema: positiveInt,
    unit: 'days',
    label: 'Duração máxima da promoção',
    description:
      'Duração máxima (dias) de um preço promocional informado pelo posto.',
  },
  'portal.competition_radius_m': {
    schema: positiveInt,
    unit: 'meters',
    label: 'Raio da concorrência',
    description:
      'Raio (metros) da concorrência local mostrada ao posto no portal.',
  },
  'claim.max_pending_per_user': {
    schema: positiveInt,
    unit: 'count',
    label: 'Pedidos em análise por conta',
    description:
      'Máximo de reivindicações de posto em análise ao mesmo tempo por conta.',
  },
  'team.invitation_valid_days': {
    schema: positiveInt,
    unit: 'days',
    label: 'Validade do convite',
    description: 'Dias de validade de um convite para a equipe de uma rede.',
  },
  'review.min_interval_days': {
    schema: positiveInt,
    unit: 'days',
    label: 'Intervalo entre avaliações',
    description:
      'Intervalo mínimo (dias) entre avaliações da mesma conta para o mesmo posto.',
  },
} satisfies Record<
  string,
  {
    schema: z.ZodType;
    unit: ParameterUnit;
    label: string;
    description: string;
  }
>;

export type ParameterKey = keyof typeof PARAMETER_DEFINITIONS;

export type ParameterValue<K extends ParameterKey> = z.output<
  (typeof PARAMETER_DEFINITIONS)[K]['schema']
>;

export const PARAMETER_KEYS = Object.keys(
  PARAMETER_DEFINITIONS,
) as ParameterKey[];

// ---------- Administração (ADR 0006) ----------

const changedBy = nullable(
  z.string(),
  'Nome (ou e-mail) de quem alterou; nulo quando foi o sistema (migration).',
);

/** Uma alteração registrada de um parâmetro. */
export const parameterChangeSchema = z.object({
  value: z.number(),
  reason: z.string(),
  changedBy,
  changedAt: z.iso.datetime(),
});
export type ParameterChange = z.infer<typeof parameterChangeSchema>;

/** Parâmetro com o valor vigente e a última alteração. */
export const adminParameterSchema = z.object({
  key: z.enum(PARAMETER_KEYS as [ParameterKey, ...ParameterKey[]]),
  group: z.string().describe('Prefixo da chave (price, portal…).'),
  label: z.string(),
  description: z.string(),
  unit: z.enum(PARAMETER_UNITS),
  value: z.number(),
  reason: z.string().describe('Motivo da última alteração.'),
  changedBy,
  changedAt: z.iso.datetime(),
  changes: z.number().int().describe('Quantas vezes o valor foi definido.'),
});
export type AdminParameter = z.infer<typeof adminParameterSchema>;

export const updateParameterSchema = z.object({
  value: z.number({ error: 'Informe um número.' }),
  reason: z
    .string({ error: 'Informe o motivo da alteração.' })
    .trim()
    .min(5, 'Explique o motivo em pelo menos 5 caracteres.')
    .max(300, 'Motivo muito longo.'),
});
export type UpdateParameter = z.output<typeof updateParameterSchema>;

/** Grupo de um parâmetro, pelo prefixo da chave. */
export function parameterGroup(key: string): string {
  return key.split('.')[0];
}
