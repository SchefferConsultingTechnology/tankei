import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { nullable } from './validation';

/**
 * Convênios (ADR 0034): cadastro único (portal cria, admin administra) e o
 * desconto de cada posto em cada convênio, por combustível. O preço no mapa
 * e na lista é sempre o sem desconto; o desconto aparece no cartão aberto
 * pelo toque e na ficha.
 */

export const DISCOUNT_KINDS = ['reais_litro', 'percentual'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export const DISCOUNT_KIND_LABELS: Record<DiscountKind, string> = {
  reais_litro: 'R$ por litro',
  percentual: '%',
};

const agreementName = z
  .string({ error: 'Informe o nome do convênio.' })
  .trim()
  .min(2, 'Nome muito curto.')
  .max(60, 'Nome muito longo (até 60 caracteres).');

const agreementDescription = z
  .string()
  .trim()
  .max(200, 'Descrição muito longa (até 200 caracteres).');

/** Convênio do cadastro, como o portal vê na busca. */
export const agreementSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: nullable(z.string(), 'Descrição, se houver.'),
});
export type Agreement = z.infer<typeof agreementSchema>;

export const agreementSearchSchema = z.object({
  q: z.string().trim().max(60).default('').describe('Parte do nome.'),
});

export const createAgreementSchema = z.object({
  name: agreementName,
  description: agreementDescription.optional(),
});
export type CreateAgreement = z.output<typeof createAgreementSchema>;

/** Desconto num combustível. */
export const agreementDiscountSchema = z.object({
  fuelType: z.enum(FUEL_TYPES, { error: 'Combustível inválido.' }),
  kind: z.enum(DISCOUNT_KINDS, { error: 'Tipo de desconto inválido.' }),
  value: z
    .number({ error: 'Informe o desconto.' })
    .positive('O desconto precisa ser maior que zero.')
    .describe('R$ por litro (ex.: 0.20) ou percentual (ex.: 3).'),
});
export type AgreementDiscount = z.infer<typeof agreementDiscountSchema>;

/** Descontos do posto num convênio (substitui os anteriores, criando versão). */
export const setStationAgreementSchema = z.object({
  discounts: z
    .array(agreementDiscountSchema)
    .min(1, 'Informe o desconto de pelo menos um combustível.')
    .refine(
      (list) => new Set(list.map((d) => d.fuelType)).size === list.length,
      'Cada combustível aparece uma vez.',
    ),
  note: z
    .string()
    .trim()
    .max(140, 'Observação muito longa (até 140 caracteres).')
    .optional()
    .describe('Ex.: "pagando pelo app", "acima de 30 litros".'),
});
export type SetStationAgreement = z.output<typeof setStationAgreementSchema>;

/** Convênio vigente no posto (no app e no portal). */
export const stationAgreementSchema = z.object({
  agreement: agreementSchema,
  discounts: z.array(agreementDiscountSchema),
  note: nullable(z.string(), 'Observação do posto, se houver.'),
  updatedAt: z.iso.datetime(),
});
export type StationAgreement = z.infer<typeof stationAgreementSchema>;

/** Convênio no cadastro, visto pelo admin. */
export const adminAgreementSchema = agreementSchema.extend({
  active: z.boolean(),
  createdFrom: z.enum(['portal', 'admin']),
  stationsUsing: z
    .number()
    .int()
    .describe('Postos com desconto vigente neste convênio.'),
  everUsed: z
    .boolean()
    .describe('Algum posto já usou: não pode ser excluído, só desativado.'),
  createdAt: z.iso.datetime(),
});
export type AdminAgreement = z.infer<typeof adminAgreementSchema>;

export const updateAgreementSchema = z.object({
  name: agreementName.optional(),
  description: agreementDescription.nullable().optional(),
  active: z.boolean().optional(),
});
export type UpdateAgreement = z.output<typeof updateAgreementSchema>;

/** Preço com o desconto, arredondado a 3 casas (como os preços da ANP). */
export function discountedPrice(
  price: number,
  discount: Pick<AgreementDiscount, 'kind' | 'value'>,
): number {
  const value =
    discount.kind === 'reais_litro'
      ? price - discount.value
      : price * (1 - discount.value / 100);
  return Math.max(0, Math.round(value * 1000) / 1000);
}

/** "−R$ 0,20" ou "−3%". */
export function describeDiscount(
  discount: Pick<AgreementDiscount, 'kind' | 'value'>,
): string {
  if (discount.kind === 'percentual') {
    return `−${discount.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  }
  return `−R$ ${discount.value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })}`;
}
