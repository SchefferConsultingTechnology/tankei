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
  activePromotions: z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        endsAt: z.iso.datetime(),
      }),
    )
    .default([])
    .describe(
      'Promoções cadastradas vigentes (ADR 0026), para o destaque na lista e no mapa.',
    ),
});

export type Station = z.infer<typeof stationSchema>;

/** Posto retornado pela busca por proximidade: sempre com coordenada. */
export const nearbyStationSchema = stationSchema.extend({
  location: locationSchema,
  distanceMeters: z.number().int(),
});

export type NearbyStation = z.infer<typeof nearbyStationSchema>;

/** Estados brasileiros, para a escolha de cidade no app. */
export const BRAZIL_STATES = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
] as const;

export type StateCode = (typeof BRAZIL_STATES)[number]['code'];

const STATE_CODES = BRAZIL_STATES.map((s) => s.code) as [
  StateCode,
  ...StateCode[],
];

/** Município oficial do IBGE (ADR 0014). */
export const municipalitySchema = z.object({
  code: z.string().describe('Código IBGE de 7 dígitos.'),
  name: z.string().describe('Nome oficial, com acentos.'),
  state: z.enum(STATE_CODES),
});

export type Municipality = z.infer<typeof municipalitySchema>;

/** Parâmetros de GET /v1/stations/cities. */
export const citiesQuerySchema = z.object({
  state: z
    .string({ error: 'Informe a UF.' })
    .trim()
    .toUpperCase()
    .pipe(z.enum(STATE_CODES, { error: 'UF inválida.' })),
});

export const cityWithStationsSchema = municipalitySchema.extend({
  stations: z.number().int().describe('Postos ativos na cidade.'),
});

export type CityWithStations = z.infer<typeof cityWithStationsSchema>;

/** Postos devolvidos por cidade: os mais baratos primeiro, até este limite. */
export const CITY_STATIONS_LIMIT = 100;

/** Parâmetros de GET /v1/stations (postos de uma cidade). */
export const cityStationsQuerySchema = z.object({
  municipality: z
    .string({ error: 'Informe o município.' })
    .regex(/^\d{7}$/, 'Município inválido.')
    .describe('Código IBGE do município.'),
  fuel: z
    .enum(FUEL_TYPES, { error: 'Combustível inválido.' })
    .optional()
    .describe(
      'Ordena pelo menor preço deste combustível. Sem ele, ordena pelo nome.',
    ),
});

export type CityStationsQuery = z.output<typeof cityStationsQuerySchema>;

export const cityStationsSchema = z.object({
  municipality: municipalitySchema,
  center: nullable(
    locationSchema,
    'Centro dos postos da cidade, para posicionar o mapa. Nulo se nenhum tem coordenada.',
  ),
  total: z.number().int().describe('Postos ativos na cidade.'),
  stations: z
    .array(stationSchema)
    .describe(`Até ${CITY_STATIONS_LIMIT} postos, os mais baratos primeiro.`),
});

export type CityStations = z.infer<typeof cityStationsSchema>;
