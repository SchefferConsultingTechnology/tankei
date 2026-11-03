import type { PriceBadge } from '@tankei/shared';

/**
 * Tokens visuais. Identidade provisória e neutra: a marca definitiva troca
 * os valores aqui, sem mexer nas telas.
 */
export const colors = {
  primary: '#0F766E',
  primaryText: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  danger: '#B91C1C',
} as const;

/** Cor de cada origem de preço (ADR 0003). */
export const badgeColors: Record<PriceBadge, string> = {
  promocao: '#7C3AED',
  atualizado_posto: '#15803D',
  confirmado_motoristas: '#1D4ED8',
  informado_motorista: '#B45309',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const fontSize = { sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 } as const;
