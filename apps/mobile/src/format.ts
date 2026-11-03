import type { IqpConfidence, PriceBadge } from '@tankei/shared';

/** Preço como na bomba: 6,29 ou 6,299. */
export function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })} km`;
}

/** "agora", "há 15 min", "há 3 h", "há 2 dias". */
export function formatAge(isoDate: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(isoDate).getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

export const BADGE_LABELS: Record<PriceBadge, string> = {
  promocao: 'Promoção',
  atualizado_posto: 'Atualizado pelo posto',
  confirmado_motoristas: 'Confirmado por motoristas',
  informado_motorista: 'Informado por motorista',
};

export const CONFIDENCE_LABELS: Record<IqpConfidence, string> = {
  baixa: 'Confiança baixa',
  media: 'Confiança média',
  alta: 'Confiança alta',
};
