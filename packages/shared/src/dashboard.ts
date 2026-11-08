import { z } from 'zod';
import { CLAIM_ORIGINS } from './owner-invite';
import { nullable } from './validation';

/**
 * Dashboard de adesão do admin (ADR 0037). Um posto "aderiu" quando entrou
 * numa rede do portal (pedido de acesso aprovado ou vínculo feito pela
 * equipe). Datas no fuso de Brasília.
 */

const isoDate = z.iso.date();

export const adhesionDashboardQuerySchema = z
  .object({
    from: isoDate.describe('Início do período (AAAA-MM-DD), inclusive.'),
    to: isoDate.describe('Fim do período (AAAA-MM-DD), inclusive.'),
    state: z
      .string()
      .regex(/^[A-Z]{2}$/, 'UF inválida.')
      .optional()
      .describe('Só postos desta UF.'),
    municipality: z
      .string()
      .regex(/^\d{7}$/, 'Município inválido.')
      .optional()
      .describe('Só postos deste município (código do IBGE).'),
  })
  .refine((q) => q.from <= q.to, {
    message: 'O início precisa ser antes do fim.',
    path: ['from'],
  });
export type AdhesionDashboardQuery = z.output<
  typeof adhesionDashboardQuerySchema
>;

export const DASHBOARD_GRANULARITIES = ['dia', 'semana', 'mes'] as const;
export type DashboardGranularity = (typeof DASHBOARD_GRANULARITIES)[number];

export const adhesionDashboardSchema = z.object({
  period: z.object({
    from: isoDate,
    to: isoDate,
    granularity: z
      .enum(DASHBOARD_GRANULARITIES)
      .describe('Até 31 dias: dia; até 6 meses: semana; acima: mês.'),
  }),
  kpis: z.object({
    adheredTotal: z.number().int().describe('Postos aderidos até o fim do período.'),
    adheredInPeriod: z.number().int(),
    adheredPreviousPeriod: z
      .number()
      .int()
      .describe('Aderidos no período anterior de mesma duração (comparação).'),
    stationsInScope: z
      .number()
      .int()
      .describe('Postos ativos no cadastro da ANP no recorte (UF/município).'),
    pendingClaims: z.number().int().describe('Pedidos em análise agora.'),
    approvedInPeriod: z.number().int(),
    rejectedInPeriod: z.number().int(),
    avgApprovalHours: nullable(
      z.number(),
      'Tempo médio do pedido à aprovação, no período.',
    ),
    updatingPrices: z
      .number()
      .int()
      .describe('Postos aderidos que informaram preço pelo portal nos últimos 7 dias do período.'),
  }),
  series: z.array(
    z.object({
      start: isoDate.describe('Início do dia, semana ou mês.'),
      adhered: z.number().int(),
      cumulative: z.number().int(),
    }),
  ),
  funnel: z.object({
    requested: z.number().int().describe('Pedidos de acesso feitos no período.'),
    approved: z.number().int().describe('Desses, aprovados.'),
    updatingPrices: z
      .number()
      .int()
      .describe('Desses postos, os que já informaram preço pelo portal.'),
  }),
  byCity: z
    .array(
      z.object({
        city: z.string(),
        state: z.string(),
        adhered: z.number().int(),
        stations: z.number().int().describe('Postos ativos da cidade na ANP.'),
      }),
    )
    .describe('Até 10 cidades com mais postos aderidos até o fim do período.'),
  byOrigin: z.array(
    z.object({
      origin: z.enum(CLAIM_ORIGINS),
      claims: z.number().int(),
    }),
  ),
});
export type AdhesionDashboard = z.infer<typeof adhesionDashboardSchema>;

// ---------- Engajamento dos usuários (ADR 0038) ----------

/** Mesmos filtros do dashboard de adesão. */
export const engagementDashboardQuerySchema = adhesionDashboardQuerySchema;
export type EngagementDashboardQuery = AdhesionDashboardQuery;

const engagementCounts = z.object({
  priceReports: z
    .number()
    .int()
    .describe('Informes de preço feitos por motoristas.'),
  reviews: z.number().int().describe('Avaliações de postos.'),
  activeUsers: z
    .number()
    .int()
    .describe('Motoristas que informaram preço ou avaliaram.'),
});

export const engagementDashboardSchema = z.object({
  period: adhesionDashboardSchema.shape.period,
  kpis: engagementCounts.extend({
    stationsInScope: z.number().int(),
    stationsWithPrices: z
      .number()
      .int()
      .describe('Postos que receberam preço de motoristas no período.'),
    stationsWithReviews: z.number().int(),
    stationsWithAny: z
      .number()
      .int()
      .describe('Postos com preço ou avaliação de motoristas no período.'),
    previous: engagementCounts.describe(
      'Os mesmos números no período anterior de mesma duração.',
    ),
  }),
  series: z.array(
    z.object({
      start: z.iso.date(),
      priceReports: z.number().int(),
      reviews: z.number().int(),
    }),
  ),
  regions: z.object({
    level: z
      .enum(['estado', 'cidade'])
      .describe('Por estado sem filtro de UF; por cidade com UF escolhida.'),
    rows: z.array(
      engagementCounts.extend({
        name: z.string(),
        state: z.string(),
        stations: z.number().int().describe('Postos ativos na ANP.'),
        stationsWithAny: z.number().int(),
      }),
    ),
  }),
});
export type EngagementDashboard = z.infer<typeof engagementDashboardSchema>;
