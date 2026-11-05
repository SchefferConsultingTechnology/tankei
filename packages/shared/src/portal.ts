import { z } from 'zod';
import { FUEL_TYPES, PRICE_SOURCES } from './fuel';
import { IQP_DIMENSIONS, stationIqpSchema } from './iqp';
import { currentPriceSchema, PRICE_REPORT_STATUSES } from './price';
import { municipalitySchema } from './station';
import { nullable } from './validation';

/**
 * Portal do posto (ADR 0012 e 0018). Só mostra ao posto o que o app já mostra
 * aos motoristas: nada de sugestão de preço nem dados que facilitem coordenação.
 */

/** Posto próximo com preço vigente, para a concorrência local. */
export const competitorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  brand: z.string(),
  distanceMeters: z.number().int(),
  price: currentPriceSchema,
});
export type Competitor = z.infer<typeof competitorSchema>;

export const fuelCompetitionSchema = z.object({
  fuelType: z.enum(FUEL_TYPES),
  price: nullable(currentPriceSchema, 'Preço vigente do posto.'),
  cityRank: nullable(
    z.object({
      position: z
        .number()
        .int()
        .describe('1 = mais barato da cidade. Empates ficam na mesma posição.'),
      total: z
        .number()
        .int()
        .describe('Postos da cidade com preço vigente deste combustível.'),
    }),
    'Posição do posto na cidade. Nula sem preço vigente do posto.',
  ),
  stateReference: nullable(
    z.object({
      weekStart: z.iso.date(),
      averagePrice: z.number(),
      referenceFuel: z
        .enum(FUEL_TYPES)
        .describe(
          'Combustível da média (a ANP não pesquisa a gasolina premium: usa a aditivada).',
        ),
    }),
    'Média semanal da ANP no estado. Nula sem referência importada.',
  ),
  nearby: z
    .array(competitorSchema)
    .describe('Postos no raio com preço vigente, do mais barato ao mais caro.'),
});
export type FuelCompetition = z.infer<typeof fuelCompetitionSchema>;

/** Parâmetros de GET /v1/portal/stations/:id/competition. */
export const competitionQuerySchema = z.object({
  radius: z
    .string()
    .regex(/^\d+$/, 'Raio inválido.')
    .transform(Number)
    .optional()
    .describe(
      'Raio em metros. Limitado ao máximo do parâmetro portal.competition_radius_m.',
    ),
});
export type CompetitionQuery = z.output<typeof competitionQuerySchema>;

export const stationCompetitionSchema = z.object({
  radiusMeters: z.number().int().describe('Raio usado na consulta.'),
  maxRadiusMeters: z
    .number()
    .int()
    .describe('Maior raio permitido (parâmetro portal.competition_radius_m).'),
  fuels: z
    .array(fuelCompetitionSchema)
    .describe('Combustíveis que o posto vende, na ordem padrão.'),
});
export type StationCompetition = z.infer<typeof stationCompetitionSchema>;

export const stationReputationSchema = z.object({
  station: stationIqpSchema,
  city: z.object({
    stations: z
      .number()
      .int()
      .describe('Postos da cidade com IQP calculado (fora "Dados insuficientes").'),
    score: nullable(
      z.number().int().min(0).max(100),
      'Média do IQP dos postos da cidade. Nula sem postos com nota.',
    ),
    dimensions: z.array(
      z.object({
        dimension: z.enum(IQP_DIMENSIONS),
        score: nullable(
          z.number().int().min(0).max(100),
          'Média da dimensão na cidade. Nula sem notas.',
        ),
      }),
    ),
  }),
});
export type StationReputation = z.infer<typeof stationReputationSchema>;

/** Parâmetros de GET /v1/portal/stations/:id/price-history. */
export const priceHistoryQuerySchema = z.object({
  fuel: z.enum(FUEL_TYPES, { error: 'Combustível inválido.' }).optional(),
  days: z
    .string()
    .regex(/^\d+$/, 'Período inválido.')
    .transform(Number)
    .pipe(z.number().int().min(1).max(90, 'Período máximo de 90 dias.'))
    .default(30)
    .describe('Dias para trás (1 a 90). Padrão: 30.'),
});
export type PriceHistoryQuery = z.output<typeof priceHistoryQuerySchema>;

export const priceHistoryEntrySchema = z.object({
  id: z.uuid(),
  fuelType: z.enum(FUEL_TYPES),
  price: z.number(),
  source: z.enum(PRICE_SOURCES),
  status: z.enum(PRICE_REPORT_STATUSES),
  reportedAt: z.iso.datetime(),
  reporter: z
    .string()
    .describe(
      'Quem informou: o nome de quem atualizou pelo posto, ou "Consumidor" com um apelido estável por posto (sem dados pessoais).',
    ),
  promotion: nullable(
    z.object({
      label: z.string(),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
    }),
    'Período e nome, quando é preço promocional.',
  ),
  current: z
    .boolean()
    .describe('Se é o informe que define o preço exibido agora no app.'),
});
export type PriceHistoryEntry = z.infer<typeof priceHistoryEntrySchema>;

export const priceHistorySchema = z.object({
  days: z.number().int(),
  entries: z
    .array(priceHistoryEntrySchema)
    .describe('Informes do período, do mais recente ao mais antigo.'),
});
export type PriceHistory = z.infer<typeof priceHistorySchema>;

/** Parâmetros de GET /v1/portal/stations/:id/city-comparison. */
export const cityComparisonQuerySchema = z.object({
  municipality: z
    .string({ error: 'Informe o município.' })
    .regex(/^\d{7}$/, 'Município inválido.')
    .describe('Código IBGE da cidade a comparar.'),
});
export type CityComparisonQuery = z.output<typeof cityComparisonQuerySchema>;

export const cityFuelStatsSchema = z.object({
  fuelType: z.enum(FUEL_TYPES),
  ownPrice: nullable(z.number(), 'Preço vigente do posto.'),
  stations: z
    .number()
    .int()
    .describe('Postos da cidade com preço vigente deste combustível.'),
  min: nullable(z.number(), 'Menor preço da cidade.'),
  average: nullable(z.number(), 'Média dos preços da cidade (3 casas).'),
  median: nullable(z.number(), 'Mediana dos preços da cidade.'),
  positionThere: nullable(
    z.object({ position: z.number().int(), total: z.number().int() }),
    'Posição que o preço do posto teria nessa cidade, contando o próprio posto no total (1 = mais barato).',
  ),
});
export type CityFuelStats = z.infer<typeof cityFuelStatsSchema>;

export const cityComparisonSchema = z.object({
  municipality: municipalitySchema,
  fuels: z.array(cityFuelStatsSchema),
});
export type CityComparison = z.infer<typeof cityComparisonSchema>;
