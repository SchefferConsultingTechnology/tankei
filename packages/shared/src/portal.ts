import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { IQP_DIMENSIONS, stationIqpSchema } from './iqp';
import { currentPriceSchema } from './price';
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

export const stationCompetitionSchema = z.object({
  radiusMeters: z.number().int().describe('Raio da concorrência local.'),
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
