export const FUEL_TYPES = [
  'gasolina_comum',
  'gasolina_aditivada',
  'gasolina_premium',
  'etanol',
  'diesel_s10',
  'diesel_s500',
  'gnv',
] as const;

export type FuelType = (typeof FUEL_TYPES)[number];

export const FUEL_LABELS: Record<FuelType, string> = {
  gasolina_comum: 'Gasolina comum',
  gasolina_aditivada: 'Gasolina aditivada',
  gasolina_premium: 'Gasolina premium',
  etanol: 'Etanol',
  diesel_s10: 'Diesel S10',
  diesel_s500: 'Diesel S500',
  gnv: 'GNV',
};

/** De onde veio um preço. Nunca sobrescrevemos: cada informe é um registro novo. */
export const PRICE_SOURCES = ['usuario', 'posto', 'anp'] as const;

export type PriceSource = (typeof PRICE_SOURCES)[number];
