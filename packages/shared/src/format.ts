import type { IqpConfidence } from './iqp';
import type { CurrentPrice, PriceBadge } from './price';

/**
 * Textos de preço, distância e prazo em pt-BR, iguais no app e no portal.
 */

/** Preço como na bomba: 6,29 ou 6,299. */
export function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

/** "850 m" ou "1,4 km". Aceita metros fracionados (distância calculada no app). */
export function formatDistance(meters: number): string {
  const rounded = Math.round(meters);
  if (rounded < 1000) return `${rounded} m`;
  return `${(rounded / 1000).toLocaleString('pt-BR', {
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

/** "até hoje, 18h", "até amanhã, 18h30", "até qua., 05/11, 18h". */
export function formatUntil(isoDate: string, now = new Date()): string {
  const end = new Date(isoDate);
  const minutes = end.getMinutes();
  const time = `${end.getHours()}h${minutes ? String(minutes).padStart(2, '0') : ''}`;

  const days = Math.round(
    (startOfDay(end).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (days === 0) return `até hoje, ${time}`;
  if (days === 1) return `até amanhã, ${time}`;
  const day = end.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  return `até ${day}, ${time}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Linha que acompanha o preço: origem e idade, ou o prazo da promoção. */
export function describePrice(price: CurrentPrice): string {
  if (price.promotion) {
    return `Promoção ${formatUntil(price.promotion.endsAt)}`;
  }
  const stale = price.stale ? 'desatualizado, ' : '';
  return `${BADGE_LABELS[price.badge]} · ${stale}${formatAge(price.updatedAt)}`;
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
