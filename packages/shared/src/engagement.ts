import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { nullable } from './validation';

/**
 * Recursos do consumidor (ADR 0029): postos favoritos, alertas de preço por
 * e-mail e o reconhecimento de quem informa preços.
 */

export const priceAlertSchema = z.object({
  id: z.uuid(),
  station: z.object({ id: z.uuid(), name: z.string() }),
  fuelType: z.enum(FUEL_TYPES),
  maxPrice: z.number().describe('Avisar quando o preço for igual ou menor.'),
  currentPrice: nullable(z.number(), 'Preço exibido agora, se houver.'),
  lastNotifiedAt: nullable(z.iso.datetime(), 'Último aviso enviado.'),
  createdAt: z.iso.datetime(),
});
export type PriceAlert = z.infer<typeof priceAlertSchema>;

export const createPriceAlertSchema = z.object({
  stationId: z.uuid({ error: 'Posto inválido.' }),
  fuelType: z.enum(FUEL_TYPES, { error: 'Combustível inválido.' }),
  maxPrice: z
    .number({ error: 'Informe o preço.' })
    .positive('Preço inválido.')
    .max(99.999, 'Preço inválido.'),
});
export type CreatePriceAlert = z.output<typeof createPriceAlertSchema>;

export const CONTRIBUTOR_LEVELS = [
  'iniciante',
  'colaborador',
  'informante_confiavel',
] as const;
export type ContributorLevel = (typeof CONTRIBUTOR_LEVELS)[number];

export const CONTRIBUTOR_LEVEL_LABELS: Record<ContributorLevel, string> = {
  iniciante: 'Iniciante',
  colaborador: 'Colaborador',
  informante_confiavel: 'Informante confiável',
};

export const CONTRIBUTOR_LEVEL_DESCRIPTIONS: Record<ContributorLevel, string> = {
  iniciante:
    'Seus informes aparecem no app. Para confirmar o informe de outras pessoas, a conta precisa de alguns dias e de um informe aceito.',
  colaborador:
    'Seus informes confirmam os de outras pessoas. Obrigado por ajudar!',
  informante_confiavel:
    'Você informa preços com frequência e acerto. Obrigado por manter os preços em dia!',
};

/** Contribuição da pessoa, vista só por ela. */
export const contributionSchema = z.object({
  level: z.enum(CONTRIBUTOR_LEVELS),
  acceptedReports: z
    .number()
    .int()
    .describe('Informes aceitos (válidos e não anulados).'),
  reportsLast30Days: z.number().int(),
  stationsHelped: z.number().int().describe('Postos diferentes informados.'),
  nextLevel: nullable(
    z.object({
      level: z.enum(CONTRIBUTOR_LEVELS),
      missing: z.string().describe('O que falta, em texto.'),
    }),
    'Próximo nível, se houver.',
  ),
});
export type Contribution = z.infer<typeof contributionSchema>;
