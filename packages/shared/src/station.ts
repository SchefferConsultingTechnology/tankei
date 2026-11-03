import type { FuelType } from './fuel';

/** Posto retornado pela busca por proximidade (GET /v1/stations/nearby). */
export interface NearbyStation {
  id: string;
  /** Nome fantasia, ou a razão social quando o posto não tem nome fantasia. */
  name: string;
  brand: string;
  address: string;
  district: string | null;
  city: string;
  state: string;
  location: { lat: number; lng: number };
  distanceMeters: number;
  fuels: FuelType[];
}

/** Limites da busca por proximidade, em metros. */
export const NEARBY_DEFAULT_RADIUS_M = 5_000;
export const NEARBY_MAX_RADIUS_M = 50_000;
export const NEARBY_MAX_RESULTS = 50;
