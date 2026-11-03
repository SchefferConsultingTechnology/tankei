import { pgEnum } from 'drizzle-orm/pg-core';
import { FUEL_TYPES, PRICE_SOURCES } from '@tankei/shared';

export const fuelTypeEnum = pgEnum('fuel_type', FUEL_TYPES);

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
