import { z } from 'zod';
import { DASHBOARD_GRANULARITIES } from './dashboard';
import { nullable } from './validation';

/**
 * Visitas dos motoristas ao posto no app (spec 0003, ADR 0039): toque no
 * cartão, ficha aberta, tempo na ficha e o que virou informe de preço ou
 * avaliação. Anônimas: sem conta e sem localização. O posto vê só totais.
 */

/** De onde veio a visita. */
export const VISIT_SOURCES = [
  'mapa',
  'lista',
  'favoritos',
  'link',
  'site',
] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

export const VISIT_SOURCE_LABELS: Record<VisitSource, string> = {
  mapa: 'Mapa',
  lista: 'Lista',
  favoritos: 'Favoritos',
  link: 'Link compartilhado',
  site: 'Site do posto',
};

/** Como a visita terminou. */
export const VISIT_CLOSE_REASONS = [
  'tempo',
  'toque_fora',
  'outro_posto',
  'saiu_da_ficha',
  'segundo_plano',
] as const;
export type VisitCloseReason = (typeof VISIT_CLOSE_REASONS)[number];

/** Ações dentro da visita (cada uma conta uma vez por visita). */
export const VISIT_ACTIONS = ['route', 'share', 'call', 'whatsapp'] as const;
export type VisitAction = (typeof VISIT_ACTIONS)[number];

export const VISIT_ACTION_LABELS: Record<VisitAction, string> = {
  route: 'Traçaram rota',
  share: 'Compartilharam',
  call: 'Ligaram',
  whatsapp: 'Chamaram no WhatsApp',
};

const isoDateTime = z.iso.datetime({ offset: true });

/** Uma visita fechada, enviada pelo app. */
export const visitInputSchema = z
  .object({
    id: z.uuid().describe('Gerado no aparelho; repetir não duplica.'),
    stationId: z.uuid(),
    visitorId: z
      .uuid()
      .describe('Aleatório por instalação do app. Não é a conta.'),
    source: z.enum(VISIT_SOURCES),
    drivingMode: z.boolean().default(false),
    openedAt: isoDateTime,
    detailOpenedAt: isoDateTime.nullable().default(null),
    detailMs: z
      .number()
      .int()
      .min(0)
      .nullable()
      .default(null)
      .describe('Tempo com a ficha em primeiro plano, em milissegundos.'),
    actions: z.array(z.enum(VISIT_ACTIONS)).max(VISIT_ACTIONS.length).default([]),
    closeReason: z.enum(VISIT_CLOSE_REASONS),
  })
  .refine((v) => (v.detailOpenedAt === null) === (v.detailMs === null), {
    message: 'Tempo na ficha só com a ficha aberta.',
    path: ['detailMs'],
  });
export type VisitInput = z.output<typeof visitInputSchema>;

export const visitBatchSchema = z.object({
  visits: z.array(visitInputSchema).min(1).max(50),
});
export type VisitBatch = z.output<typeof visitBatchSchema>;

export const visitBatchResultSchema = z.object({
  accepted: z
    .number()
    .int()
    .describe('Visitas gravadas agora (repetidas e descartadas não contam).'),
});
export type VisitBatchResult = z.infer<typeof visitBatchResultSchema>;

// --- Leitura no portal ---

const isoDate = z.iso.date();

export const stationVisitsQuerySchema = z
  .object({
    from: isoDate.describe('Início do período (AAAA-MM-DD), inclusive.'),
    to: isoDate.describe('Fim do período (AAAA-MM-DD), inclusive.'),
  })
  .refine((q) => q.from <= q.to, {
    message: 'O início precisa ser antes do fim.',
    path: ['from'],
  });
export type StationVisitsQuery = z.output<typeof stationVisitsQuerySchema>;

/** Contagem que some (nula) abaixo do mínimo de anonimato. */
const count = (description: string) =>
  nullable(
    z.number().int(),
    `${description} Nulo: menos que o mínimo de anonimato (minBucket).`,
  );

const totals = z.object({
  visits: count('Visitas.'),
  visitors: count('Visitantes únicos.'),
  detailVisits: count('Visitas com a ficha aberta.'),
  priceReports: count('Visitas que viraram informe de preço.'),
  reviews: count('Visitas que viraram avaliação.'),
});

export const stationVisitsSchema = z.object({
  period: z.object({
    from: isoDate,
    to: isoDate,
    granularity: z
      .enum(DASHBOARD_GRANULARITIES)
      .describe(
        'Até 31 dias: dia; até 6 meses: semana; acima: mês. Com pouco movimento (mais da metade dos períodos abaixo do mínimo), sobe um nível.',
      ),
  }),
  minBucket: z
    .number()
    .int()
    .describe('Abaixo deste número, a contagem aparece como "menos de N".'),
  kpis: totals.extend({
    medianDetailSeconds: nullable(
      z.number(),
      'Tempo típico (mediana) na ficha, em segundos.',
    ),
    previous: totals.describe('Período anterior de mesma duração.'),
  }),
  series: z.array(
    z.object({
      start: isoDate,
      visits: count('Visitas.'),
      detailVisits: count('Visitas com ficha.'),
    }),
  ),
  bySource: z.array(
    z.object({ source: z.enum(VISIT_SOURCES), visits: count('Visitas.') }),
  ),
  /** Por dia da semana (0 = domingo), no fuso de Brasília. */
  byWeekday: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      visits: count('Visitas.'),
    }),
  ),
  /** Por faixa de 3 horas do dia, no fuso de Brasília. */
  byHour: z.array(
    z.object({
      hour: z.number().int().min(0).max(21).describe('Início da faixa de 3 h.'),
      visits: count('Visitas.'),
    }),
  ),
  actions: z.array(
    z.object({ action: z.enum(VISIT_ACTIONS), visits: count('Visitas.') }),
  ),
});
export type StationVisits = z.infer<typeof stationVisitsSchema>;

// --- Recursos do plano por posto ---

/**
 * Recursos liberados por posto. Enquanto o Mercado Pago não existe, a equipe
 * libera pelo admin; depois, a assinatura passa a liberar.
 */
export const STATION_FEATURES = ['visitas'] as const;
export type StationFeature = (typeof STATION_FEATURES)[number];

export const STATION_FEATURE_LABELS: Record<StationFeature, string> = {
  visitas: 'Visitas no portal',
};

export const stationFeatureStateSchema = z.object({
  feature: z.enum(STATION_FEATURES),
  active: z.boolean(),
  note: nullable(z.string(), 'Observação da equipe.'),
  changedAt: nullable(z.iso.datetime(), 'Última mudança; nulo se nunca mudou.'),
  changedBy: nullable(z.string(), 'Quem mudou (nome).'),
});
export type StationFeatureState = z.infer<typeof stationFeatureStateSchema>;

export const stationFeaturesSchema = z.object({
  features: z.array(stationFeatureStateSchema),
});
export type StationFeatures = z.infer<typeof stationFeaturesSchema>;

export const setStationFeatureSchema = z.object({
  active: z.boolean(),
  note: z.string().trim().max(200, 'Observação muito longa.').optional(),
});
export type SetStationFeature = z.output<typeof setStationFeatureSchema>;

/** Código do erro 403 quando o posto não tem o recurso. */
export const FEATURE_LOCKED = 'FEATURE_LOCKED';
