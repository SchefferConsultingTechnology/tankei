import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { PRICE_REPORT_STATUSES } from './price';
import { nullable } from './validation';

/**
 * Moderação de informes de preço (ADR 0020 e 0024). O posto contesta informes
 * de consumidores; rajadas suspeitas abrem um caso sozinhas. Enquanto o caso
 * está em análise, os informes não contam no preço exibido. A equipe Tankei
 * mantém ou anula; nada é apagado.
 */

export const MODERATION_KINDS = ['contestacao', 'rajada'] as const;
export type ModerationKind = (typeof MODERATION_KINDS)[number];

export const MODERATION_KIND_LABELS: Record<ModerationKind, string> = {
  contestacao: 'Contestação do posto',
  rajada: 'Rajada de informes',
};

export const MODERATION_DECISIONS = ['mantido', 'anulado'] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

export const MODERATION_STATUSES = ['em_analise', 'mantido', 'anulado'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  em_analise: 'Em análise',
  mantido: 'Informes mantidos',
  anulado: 'Informes anulados',
};

const reason = (what: string) =>
  z
    .string({ error: `Informe ${what}.` })
    .trim()
    .min(5, 'Explique em pelo menos 5 caracteres.')
    .max(300, 'Texto muito longo.');

/** Contestação pelo posto: informes de consumidores do mesmo combustível. */
export const createContestSchema = z.object({
  reportIds: z
    .array(z.uuid({ error: 'Informe inválido.' }))
    .min(1, 'Escolha ao menos um informe.')
    .max(20, 'Informes demais de uma vez.'),
  reason: reason('o motivo da contestação').describe(
    'Por que o posto contesta (a equipe Tankei lê antes de decidir).',
  ),
});
export type CreateContest = z.output<typeof createContestSchema>;

/** Caso visto pelo posto no portal. */
export const stationModerationCaseSchema = z.object({
  id: z.uuid(),
  kind: z.enum(MODERATION_KINDS),
  status: z.enum(MODERATION_STATUSES),
  fuelType: z.enum(FUEL_TYPES),
  prices: z.array(z.number()).describe('Valores informados no caso.'),
  reports: z.number().int().describe('Quantos informes.'),
  reason: nullable(z.string(), 'Motivo do posto (contestação).'),
  decisionReason: nullable(z.string(), 'Explicação da equipe Tankei.'),
  createdAt: z.iso.datetime(),
  decidedAt: nullable(z.iso.datetime(), 'Quando a equipe decidiu.'),
});
export type StationModerationCase = z.infer<typeof stationModerationCaseSchema>;

// ---------- Administração ----------

export const moderationQuerySchema = z.object({
  status: z
    .enum(['em_analise', 'decididos'], { error: 'Situação inválida.' })
    .default('em_analise'),
});
export type ModerationQuery = z.output<typeof moderationQuerySchema>;

export const moderationReportSchema = z.object({
  id: z.uuid(),
  price: z.number(),
  reportedAt: z.iso.datetime(),
  reporter: z.string().describe('Apelido do consumidor neste posto.'),
  status: z.enum(PRICE_REPORT_STATUSES),
  atStation: nullable(
    z.boolean(),
    'Se estava perto do posto ao informar; nulo sem localização.',
  ),
  trusted: nullable(
    z.boolean(),
    'Se a conta já era confiável ao informar (ADR 0024).',
  ),
  reporterAccountDays: nullable(
    z.number().int(),
    'Idade da conta, em dias, ao informar.',
  ),
});
export type ModerationReport = z.infer<typeof moderationReportSchema>;

export const adminModerationCaseSchema = z.object({
  id: z.uuid(),
  kind: z.enum(MODERATION_KINDS),
  status: z.enum(MODERATION_STATUSES),
  station: z.object({
    id: z.uuid(),
    name: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  fuelType: z.enum(FUEL_TYPES),
  openedBy: nullable(
    z.string(),
    'Quem do posto contestou; nulo quando o sistema abriu (rajada).',
  ),
  reason: nullable(z.string(), 'Motivo do posto.'),
  createdAt: z.iso.datetime(),
  reports: z.array(moderationReportSchema),
  stationPrice: nullable(
    z.object({ price: z.number(), reportedAt: z.iso.datetime() }),
    'Último preço informado pelo posto para o combustível.',
  ),
  decision: nullable(
    z.object({
      decision: z.enum(MODERATION_DECISIONS),
      reason: z.string(),
      decidedBy: nullable(z.string(), 'Nome de quem decidiu.'),
      decidedAt: z.iso.datetime(),
    }),
    'Decisão, quando já houve.',
  ),
});
export type AdminModerationCase = z.infer<typeof adminModerationCaseSchema>;

export const decideModerationSchema = z.object({
  decision: z.enum(MODERATION_DECISIONS, { error: 'Escolha a decisão.' }),
  reason: reason('a explicação').describe(
    'Explicação da decisão; o posto vê no portal.',
  ),
});
export type DecideModeration = z.output<typeof decideModerationSchema>;
