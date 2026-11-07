import { pgEnum } from 'drizzle-orm/pg-core';
import {
  AUTH_PROVIDERS,
  CLAIM_ORIGINS,
  CLAIM_POSITIONS,
  FUEL_TYPES,
  IQP_CONFIDENCE_LEVELS,
  MANAGER_ROLES,
  HIDE_REASONS,
  MODERATION_DECISIONS,
  MODERATION_KINDS,
  ORG_ROLES,
  ORG_SCOPES,
  PRICE_SOURCES,
  STATION_MODES,
  USER_ROLES,
  VERIFICATION_METHODS,
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

/** Papel no posto (ADR 0011). */
export const managerRoleEnum = pgEnum('manager_role', MANAGER_ROLES);

/** Como o vínculo com o posto foi comprovado (ADR 0011). */
export const verificationMethodEnum = pgEnum(
  'verification_method',
  VERIFICATION_METHODS,
);

export const claimOriginEnum = pgEnum('claim_origin', CLAIM_ORIGINS);

export const claimPositionEnum = pgEnum('claim_position', CLAIM_POSITIONS);

export const claimDecisionEnum = pgEnum('claim_decision', [
  'aprovado',
  'recusado',
]);

/** Papel na rede de postos (ADR 0021). */
export const orgRoleEnum = pgEnum('org_role', ORG_ROLES);

/** Escopo do membro: todas as unidades da rede ou as escolhidas. */
export const orgScopeEnum = pgEnum('org_scope', ORG_SCOPES);

/** Moderação de informes de preço (ADR 0020 e 0024). */
export const moderationKindEnum = pgEnum('moderation_kind', MODERATION_KINDS);

export const moderationDecisionEnum = pgEnum(
  'moderation_decision',
  MODERATION_DECISIONS,
);

/** Como o posto aparece no app (ADR 0028). */
export const stationModeEnum = pgEnum('station_mode', STATION_MODES);

export const hideReasonEnum = pgEnum('hide_reason', HIDE_REASONS);
