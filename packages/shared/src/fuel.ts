export const FUEL_TYPES = [
  'gasolina_comum',
  'gasolina_aditivada',
  'gasolina_premium',
  'etanol',
  'diesel_s10',
  'diesel_s500',
  'gnv',
  'recarga_ac',
  'recarga_dc',
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
  recarga_ac: 'Recarga AC',
  recarga_dc: 'Recarga DC',
};

/**
 * Recarga elétrica (ADR 0041): AC e DC entram como "combustíveis", com preço
 * por kWh. Reaproveitam informes, confiança, alertas e a ordem por preço.
 */
export const CHARGING_FUELS = ['recarga_ac', 'recarga_dc'] as const;
export type ChargingFuel = (typeof CHARGING_FUELS)[number];

export function isCharging(fuel: FuelType): fuel is ChargingFuel {
  return (CHARGING_FUELS as readonly string[]).includes(fuel);
}

/** Unidade do preço: litro, metro cúbico (GNV) ou kWh (recarga). */
export const FUEL_UNITS: Record<FuelType, string> = {
  gasolina_comum: 'L',
  gasolina_aditivada: 'L',
  gasolina_premium: 'L',
  etanol: 'L',
  diesel_s10: 'L',
  diesel_s500: 'L',
  gnv: 'm³',
  recarga_ac: 'kWh',
  recarga_dc: 'kWh',
};

/** De onde veio um preço. Nunca sobrescrevemos: cada informe é um registro novo. */
export const PRICE_SOURCES = ['usuario', 'posto', 'anp'] as const;

export type PriceSource = (typeof PRICE_SOURCES)[number];
