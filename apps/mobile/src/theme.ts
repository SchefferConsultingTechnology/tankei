import type { PriceBadge } from '@tankei/shared';

/**
 * Tokens visuais da marca Tankei (ADR 0017), em tema claro e escuro. As telas
 * leem as cores por useTheme()/createStyles (src/appearance.tsx), nunca daqui
 * direto, para acompanhar o tema escolhido.
 */

export type Scheme = 'light' | 'dark';

/** Cores do logo. */
export const brand = {
  navy: '#012049',
  orange: '#FD6000',
  orangeLight: '#FD9E02',
  orangeDeep: '#FD3900',
} as const;

export interface Palette {
  /** Cor de ação: botões, item selecionado. */
  primary: string;
  /** Texto e ícones sobre `primary`. */
  primaryText: string;
  /** Destaque da marca (ícones e indicadores; não para texto pequeno no claro). */
  accent: string;
  background: string;
  surface: string;
  /** Fundo de campos e trilhos (segmentado, seletores). */
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  danger: string;
  /** Avisos (ex.: consumidores informaram outro preço, ADR 0020). Texto ≥ 4,5:1. */
  warning: string;
  /** Sombra de elementos flutuantes. */
  shadow: string;
  /** Véu atrás de painéis. */
  backdrop: string;
  star: string;
}

// Contraste (WCAG) conferido no ADR 0017: texto ≥ 4,5:1; ícones e destaques ≥ 3:1.
export const palettes: Record<Scheme, Palette> = {
  light: {
    primary: brand.navy,
    primaryText: '#FFFFFF',
    accent: '#E8590C',
    background: '#F5F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF2F8',
    border: '#D9E0EA',
    text: '#0F1B33',
    textMuted: '#5B6B85',
    danger: '#B91C1C',
    warning: '#B45309',
    shadow: '#000000',
    backdrop: 'rgba(1, 32, 73, 0.45)',
    star: '#F59E0B',
  },
  dark: {
    primary: '#FF7A1A',
    primaryText: brand.navy,
    accent: '#FF8A2B',
    background: '#07122A',
    surface: '#0F1E3D',
    surfaceAlt: '#162A50',
    border: '#24395F',
    text: '#F1F5FB',
    textMuted: '#9AABC6',
    danger: '#F87171',
    warning: '#FCD34D',
    shadow: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.6)',
    star: '#FBBF24',
  },
};

/** Cor de cada origem de preço (ADR 0003), legível em cada tema. */
export const badgePalettes: Record<Scheme, Record<PriceBadge, string>> = {
  light: {
    promocao: '#7C3AED',
    atualizado_posto: '#15803D',
    confirmado_motoristas: '#1D4ED8',
    informado_motorista: '#B45309',
  },
  dark: {
    promocao: '#C4B5FD',
    atualizado_posto: '#4ADE80',
    confirmado_motoristas: '#93C5FD',
    informado_motorista: '#FCD34D',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const fontSize = { sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 } as const;
