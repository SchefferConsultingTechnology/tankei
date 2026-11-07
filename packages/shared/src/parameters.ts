import { z } from 'zod';
import { nullable } from './validation';

const percent = z.number().min(0).max(100);
const positiveInt = z.number().int().positive();

/** Unidade do valor, para exibir e validar no admin. */
export const PARAMETER_UNITS = [
  'percent',
  'seconds',
  'minutes',
  'hours',
  'days',
  'meters',
  'megabytes',
  'count',
] as const;
export type ParameterUnit = (typeof PARAMETER_UNITS)[number];

export const PARAMETER_UNIT_LABELS: Record<ParameterUnit, string> = {
  percent: '%',
  seconds: 'segundos',
  minutes: 'minutos',
  hours: 'horas',
  days: 'dias',
  meters: 'm',
  megabytes: 'MB',
  count: '',
};

/** Grupo do parâmetro (prefixo da chave), na ordem do admin. */
export const PARAMETER_GROUP_LABELS: Record<string, string> = {
  price: 'Preços',
  portal: 'Portal do posto',
  claim: 'Pedidos de acesso',
  media: 'Fotos e promoções',
  alert: 'Favoritos e alertas',
  contributor: 'Contribuição',
  team: 'Equipe',
  review: 'Avaliações',
  app: 'App',
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
  'price.divergence_response_hours': {
    schema: positiveInt,
    unit: 'hours',
    label: 'Prazo para o posto responder',
    description:
      'Horas que o posto tem para reconfirmar ou contestar quando consumidores confirmam outro valor. Depois, vale o valor dos consumidores.',
  },
  'price.trusted_min_account_days': {
    schema: z.number().int().min(0),
    unit: 'days',
    label: 'Idade mínima da conta para confirmar',
    description:
      'Dias de conta para o informe contar como confirmação do informe de outra pessoa.',
  },
  'price.trusted_min_accepted_reports': {
    schema: z.number().int().min(0),
    unit: 'count',
    label: 'Informes aceitos para confirmar',
    description:
      'Informes anteriores aceitos (válidos e não anulados) para a conta confirmar o informe de outra pessoa.',
  },
  'price.near_station_m': {
    schema: positiveInt,
    unit: 'meters',
    label: 'Distância para "estava no posto"',
    description:
      'Distância máxima (metros) entre a pessoa e o posto para o informe contar como feito no posto.',
  },
  'price.away_weight_pct': {
    schema: percent,
    unit: 'percent',
    label: 'Peso de quem informa à distância',
    description:
      'Peso (%) na confirmação do informe feito longe do posto ou sem localização. No posto, o peso é 100%.',
  },
  'price.burst_window_minutes': {
    schema: positiveInt,
    unit: 'minutes',
    label: 'Janela da rajada',
    description:
      'Minutos em que informes iguais, de contas novas ou longe do posto, contam como rajada.',
  },
  'price.burst_min_reports': {
    schema: z.number().int().min(2),
    unit: 'count',
    label: 'Informes para rajada',
    description:
      'Informes iguais e destoantes na janela que mandam o caso para a moderação em vez de mudar o preço.',
  },
  'portal.competition_radius_m': {
    schema: positiveInt,
    unit: 'meters',
    label: 'Raio da concorrência',
    description:
      'Raio (metros) da concorrência local mostrada ao posto no portal.',
  },
  'media.max_station_photos': {
    schema: positiveInt,
    unit: 'count',
    label: 'Fotos por posto',
    description: 'Máximo de fotos publicadas ao mesmo tempo por posto.',
  },
  'media.max_upload_mb': {
    schema: z.number().int().min(1).max(20),
    unit: 'megabytes',
    label: 'Tamanho máximo da imagem',
    description:
      'Tamanho máximo (MB) de uma foto ou arte enviada. A API reduz e converte para WebP.',
  },
  'alert.max_per_user': {
    schema: positiveInt,
    unit: 'count',
    label: 'Alertas de preço por conta',
    description: 'Máximo de alertas de preço ativos por conta.',
  },
  'alert.min_interval_hours': {
    schema: positiveInt,
    unit: 'hours',
    label: 'Intervalo entre avisos',
    description:
      'Horas mínimas entre dois e-mails do mesmo alerta de preço, para não incomodar.',
  },
  'favorite.max_per_user': {
    schema: positiveInt,
    unit: 'count',
    label: 'Favoritos por conta',
    description: 'Máximo de postos favoritos por conta.',
  },
  'contributor.reliable_min_reports': {
    schema: positiveInt,
    unit: 'count',
    label: 'Informes para "informante confiável"',
    description:
      'Informes aceitos para o selo "Informante confiável" (além de conta confiável e nenhum informe anulado nos últimos 90 dias).',
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
  'app.map_card_close_seconds': {
    schema: z.number().int().min(0).max(120),
    unit: 'seconds',
    label: 'Fechamento do cartão no mapa',
    description:
      'Segundos até o cartão aberto pelo toque num posto do mapa fechar sozinho (ADR 0033). 0 = não fecha sozinho.',
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
