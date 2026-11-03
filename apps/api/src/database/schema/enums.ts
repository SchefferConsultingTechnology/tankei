import { pgEnum } from 'drizzle-orm/pg-core';
import {
  AUTH_PROVIDERS,
  FUEL_TYPES,
  IQP_CONFIDENCE_LEVELS,
  PRICE_SOURCES,
  USER_ROLES,
} from '@tankei/shared';

export const iqpConfidenceEnum = pgEnum(
  'iqp_confidence',
  IQP_CONFIDENCE_LEVELS,
);

export const fuelTypeEnum = pgEnum('fuel_type', FUEL_TYPES);

export const userRoleEnum = pgEnum('user_role', USER_ROLES);

export const authProviderEnum = pgEnum('auth_provider', AUTH_PROVIDERS);

export const priceSourceEnum = pgEnum('price_source', PRICE_SOURCES);

/** Situação definida na entrada do informe (ADR 0003). Não muda depois. */
export const priceReportStatusEnum = pgEnum('price_report_status', [
  'valido',
  'suspeito',
  'rejeitado',
]);

/** De onde veio a coordenada do posto. */
export const locationSourceEnum = pgEnum('location_source', [
  'anp',
  'geocodificacao',
  'campo',
]);
