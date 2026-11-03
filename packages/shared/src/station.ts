import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { iqpSummarySchema } from './iqp';
import { currentPriceSchema } from './price';
import { nullable, numericString } from './validation';

/** Limites da busca por proximidade, em metros. */
export const NEARBY_DEFAULT_RADIUS_M = 5_000;
export const NEARBY_MAX_RADIUS_M = 50_000;
export const NEARBY_MAX_RESULTS = 50;

const radiusMessage = `O raio deve estar entre 1 e ${NEARBY_MAX_RADIUS_M} metros.`;

/** Parâmetros de GET /v1/stations/nearby. */
export const nearbyQuerySchema = z.object({
  lat: numericString('Latitude inválida.')
    .pipe(
      z.number().min(-90, 'Latitude inválida.').max(90, 'Latitude inválida.'),
    )
    .describe('Latitude do ponto de busca (WGS 84).'),
  lng: numericString('Longitude inválida.')
    .pipe(
      z
        .number()
        .min(-180, 'Longitude inválida.')
        .max(180, 'Longitude inválida.'),
    )
    .describe('Longitude do ponto de busca (WGS 84).'),
  radius: numericString('Raio inválido.')
    .pipe(
      z
        .number()
        .int('Raio inválido.')
        .min(1, radiusMessage)
        .max(NEARBY_MAX_RADIUS_M, radiusMessage),
    )
    .default(NEARBY_DEFAULT_RADIUS_M)
    .describe(
      `Raio da busca em metros. Padrão ${NEARBY_DEFAULT_RADIUS_M}, máximo ${NEARBY_MAX_RADIUS_M}.`,
    ),
  fuel: z
    .enum(FUEL_TYPES, {
      error: `Combustível inválido. Use: ${FUEL_TYPES.join(', ')}.`,
    })
    .optional()
    .describe('Mostra só postos que vendem este combustível.'),
});

export type NearbyQuery = z.output<typeof nearbyQuerySchema>;

const locationSchema = z.object({ lat: z.number(), lng: z.number() });

/** Posto com preços vigentes e resumo do IQP (GET /v1/stations/{id}). */
export const stationSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .describe(
      'Nome fantasia, ou a razão social quando o posto não tem nome fantasia.',
    ),
  brand: z.string(),
  address: z.string(),
  district: nullable(z.string(), 'Bairro, quando informado.'),
  city: z.string(),
  state: z.string(),
  location: nullable(
    locationSchema,
    'Nula enquanto o posto não tiver coordenada.',
  ),
  fuels: z.array(z.enum(FUEL_TYPES)),
  prices: z
    .array(currentPriceSchema)
    .describe('Preço vigente de cada combustível que tem preço exibível.'),
  iqp: iqpSummarySchema,
});

export type Station = z.infer<typeof stationSchema>;

/** Posto retornado pela busca por proximidade: sempre com coordenada. */
export const nearbyStationSchema = stationSchema.extend({
  location: locationSchema,
  distanceMeters: z.number().int(),
});

export type NearbyStation = z.infer<typeof nearbyStationSchema>;
