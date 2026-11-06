import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { nullable } from './validation';

/** Situação do informe, definida na entrada (ADR 0006). */
export const PRICE_REPORT_STATUSES = [
  'valido',
  'suspeito',
  'rejeitado',
] as const;
export type PriceReportStatus = (typeof PRICE_REPORT_STATUSES)[number];

/**
 * Origem do preço exibido (ADR 0003). "Desatualizado" não é um selo à parte:
 * vem em `stale`, junto da origem.
 */
export const PRICE_BADGES = [
  'promocao',
  'atualizado_posto',
  'confirmado_motoristas',
  'informado_motorista',
] as const;
export type PriceBadge = (typeof PRICE_BADGES)[number];

const isoDateTime = (message: string) =>
  z.iso
    .datetime({ offset: true, error: message })
    .transform((value) => new Date(value));

export const priceReportRequestSchema = z.object({
  fuelType: z.enum(FUEL_TYPES, { error: 'Combustível inválido.' }),
  price: z
    .number({ error: 'Preço inválido.' })
    .positive('Preço inválido.')
    .max(99.999, 'Preço inválido.')
    .refine(
      (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6,
      'Use no máximo 3 casas decimais.',
    )
    .describe('Preço por litro (ou m³ no GNV), como na bomba: 6.299.'),
  confirmed: z
    .boolean()
    .default(false)
    .describe(
      'Envie true depois que a pessoa confirmar um valor muito diferente do preço atual.',
    ),
  position: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional()
    .describe(
      'Posição de quem informa, para saber se estava no posto (ADR 0020). A API guarda só sim ou não, nunca a posição.',
    ),
  promotion: z
    .object({
      label: z
        .string()
        .trim()
        .min(1, 'Informe o nome da promoção.')
        .max(60, 'Nome da promoção muito longo.'),
      startsAt: isoDateTime('Início da promoção inválido.'),
      endsAt: isoDateTime('Fim da promoção inválido.'),
    })
    .refine((p) => p.endsAt > p.startsAt, {
      message: 'O fim da promoção deve ser depois do início.',
      path: ['endsAt'],
    })
    .optional()
    .describe('Preço promocional com período. Só para gestores do posto.'),
});
export type PriceReportRequest = z.output<typeof priceReportRequestSchema>;

export const priceReportResponseSchema = z.object({
  id: z.uuid(),
  status: z.enum(PRICE_REPORT_STATUSES),
  message: z.string().describe('Mensagem para exibir à pessoa.'),
});
export type PriceReportResponse = z.infer<typeof priceReportResponseSchema>;

export const currentPriceSchema = z.object({
  fuelType: z.enum(FUEL_TYPES),
  price: z.number(),
  badge: z.enum(PRICE_BADGES),
  stale: z
    .boolean()
    .describe(
      'Sem informe novo há mais dias que o configurado: "Desatualizado".',
    ),
  updatedAt: z.iso.datetime(),
  promotion: nullable(
    z.object({ label: z.string(), endsAt: z.iso.datetime() }),
    'Promoção vigente, quando o preço é promocional.',
  ),
  divergence: nullable(
    z.object({
      price: z.number().describe('Valor confirmado por consumidores.'),
      reportedAt: z.iso.datetime(),
      respondBy: z.iso.datetime().describe(
        'Até quando o posto pode reconfirmar ou contestar; depois, vale o valor dos consumidores.',
      ),
    }),
    'Consumidores confirmaram um valor diferente do preço do posto (ADR 0020).',
  ).default(null),
  otherValueReported: z
    .boolean()
    .default(false)
    .describe('Consumidores informaram também outro valor recentemente.'),
});
export type CurrentPrice = z.infer<typeof currentPriceSchema>;
