import { z } from 'zod';
import type { ChargingFuel } from './fuel';
import { nullable } from './validation';

/**
 * Pontos de recarga elétrica do posto (ADR 0041). O posto (portal) ou a
 * equipe (admin) cadastram; sem cadastro oficial, o consumidor sugere e o
 * ponto aparece depois de confirmado por outros (parâmetro
 * charger.min_confirmations). O preço por kWh é informado como o de um
 * combustível (recarga_ac e recarga_dc).
 */

export const CHARGER_CURRENTS = ['ac', 'dc'] as const;
export type ChargerCurrent = (typeof CHARGER_CURRENTS)[number];

export const CHARGER_CURRENT_LABELS: Record<ChargerCurrent, string> = {
  ac: 'AC (lenta)',
  dc: 'DC (rápida)',
};

/** Combustível de preço de cada tipo de corrente. */
export const CHARGER_FUEL: Record<ChargerCurrent, ChargingFuel> = {
  ac: 'recarga_ac',
  dc: 'recarga_dc',
};

export const CONNECTORS = ['tipo2', 'ccs2', 'chademo', 'gbt', 'tipo1'] as const;
export type Connector = (typeof CONNECTORS)[number];

export const CONNECTOR_LABELS: Record<Connector, string> = {
  tipo2: 'Tipo 2',
  ccs2: 'CCS2',
  chademo: 'CHAdeMO',
  gbt: 'GB/T',
  tipo1: 'Tipo 1',
};

export const CHARGER_ACCESS = ['publico', 'clientes'] as const;
export type ChargerAccess = (typeof CHARGER_ACCESS)[number];

export const CHARGER_ACCESS_LABELS: Record<ChargerAccess, string> = {
  publico: 'Aberto ao público',
  clientes: 'Só para clientes',
};

export const CHARGER_PAYMENTS = ['app', 'caixa', 'gratuito'] as const;
export type ChargerPayment = (typeof CHARGER_PAYMENTS)[number];

export const CHARGER_PAYMENT_LABELS: Record<ChargerPayment, string> = {
  app: 'Pelo app da operadora',
  caixa: 'No caixa do posto',
  gratuito: 'Gratuita',
};

/** Ponto de recarga cadastrado pelo posto ou pela equipe. */
export const chargerSchema = z.object({
  current: z.enum(CHARGER_CURRENTS, { error: 'Escolha AC ou DC.' }),
  connector: z.enum(CONNECTORS, { error: 'Escolha o conector.' }),
  powerKw: z
    .number({ error: 'Informe a potência.' })
    .positive('Informe a potência.')
    .max(1000, 'Potência acima de 1.000 kW: confira.')
    .describe('Potência em kW.'),
  count: z
    .number({ error: 'Informe a quantidade.' })
    .int()
    .min(1, 'Pelo menos 1 ponto.')
    .max(50, 'Até 50 pontos do mesmo tipo.'),
  access: z.enum(CHARGER_ACCESS).default('publico'),
  payments: z.array(z.enum(CHARGER_PAYMENTS)).max(3).default([]),
  operator: z
    .string()
    .trim()
    .max(60, 'Nome da operadora muito longo.')
    .optional()
    .describe('Operadora ou app usado para pagar (ex.: Zletric).'),
  timeBased: z
    .boolean()
    .default(false)
    .describe('Cobra por tempo, não por kWh: o app não compara o preço.'),
  fees: z
    .string()
    .trim()
    .max(140, 'Observação muito longa (até 140 caracteres).')
    .optional()
    .describe('Taxas extras, como por sessão ou por ociosidade. Não entram na comparação.'),
});
export type Charger = z.output<typeof chargerSchema>;

export const setChargersSchema = z.object({
  chargers: z
    .array(chargerSchema)
    .max(10, 'Até 10 tipos de ponto.')
    .describe('Lista completa; vazia quando o posto não tem recarga.'),
});
export type SetChargers = z.output<typeof setChargersSchema>;

/** Ponto como o app vê: campos nulos quando veio de sugestão de consumidores. */
export const stationChargerSchema = z.object({
  current: z.enum(CHARGER_CURRENTS),
  connector: nullable(z.enum(CONNECTORS), 'Conector; nulo se não informado.'),
  powerKw: nullable(z.number(), 'Potência em kW; nula se não informada.'),
  count: nullable(z.number().int(), 'Quantidade; nula se não informada.'),
  access: nullable(z.enum(CHARGER_ACCESS), 'Acesso; nulo se não informado.'),
  payments: z.array(z.enum(CHARGER_PAYMENTS)),
  operator: nullable(z.string(), 'Operadora, se informada.'),
  timeBased: z.boolean(),
  fees: nullable(z.string(), 'Taxas extras, se informadas.'),
});
export type StationCharger = z.infer<typeof stationChargerSchema>;

export const CHARGER_SOURCES = ['posto', 'equipe', 'usuarios'] as const;
export type ChargerSource = (typeof CHARGER_SOURCES)[number];

export const stationChargingSchema = z.object({
  source: z
    .enum(CHARGER_SOURCES)
    .describe('Quem informou: o posto, a equipe Tankei ou consumidores (confirmado).'),
  chargers: z.array(stationChargerSchema),
  updatedAt: z.iso.datetime(),
});
export type StationCharging = z.infer<typeof stationChargingSchema>;

/** Sugestão do consumidor: "este posto tem recarga". */
export const suggestChargerSchema = z.object({
  current: z.enum(CHARGER_CURRENTS, { error: 'Escolha AC ou DC.' }),
  connector: z.enum(CONNECTORS).optional(),
});
export type SuggestCharger = z.output<typeof suggestChargerSchema>;

export const suggestChargerResultSchema = z.object({
  confirmed: z
    .boolean()
    .describe('O ponto já aparece no app (confirmado por consumidores suficientes).'),
  message: z.string(),
});
export type SuggestChargerResult = z.infer<typeof suggestChargerResultSchema>;

/** Visão do portal e do admin: oficial e sugestões. */
export const chargingAdminSchema = z.object({
  official: nullable(
    z.object({
      source: z.enum(['posto', 'equipe']),
      chargers: z.array(chargerSchema),
      updatedAt: z.iso.datetime(),
      updatedBy: nullable(z.string(), 'Quem alterou (nome).'),
    }),
    'Cadastro oficial; nulo se nunca cadastrado.',
  ),
  suggestions: z.array(
    z.object({
      current: z.enum(CHARGER_CURRENTS),
      people: z.number().int().describe('Consumidores diferentes que sugeriram.'),
      connectors: z.array(z.enum(CONNECTORS)),
      confirmed: z.boolean(),
      lastAt: z.iso.datetime(),
    }),
  ),
  minConfirmations: z.number().int(),
});
export type ChargingAdmin = z.infer<typeof chargingAdminSchema>;

export const dismissChargerSuggestionsSchema = z.object({
  current: z.enum(CHARGER_CURRENTS),
  reason: z
    .string({ error: 'Informe o motivo.' })
    .trim()
    .min(3, 'Informe o motivo.')
    .max(200, 'Motivo muito longo.'),
});
export type DismissChargerSuggestions = z.output<
  typeof dismissChargerSuggestionsSchema
>;
