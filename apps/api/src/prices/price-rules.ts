import type {
  PriceBadge,
  PriceReportStatus,
  PriceSource,
} from '@tankei/shared';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ClassificationParams {
  normalPct: number;
  maxPct: number;
}

export interface Classification {
  status: PriceReportStatus;
  /** Distância da referência em %, ou null sem referência. */
  deviationPct: number | null;
}

/**
 * Situação do informe pela distância da referência da ANP (ADR 0006).
 * Promoções do posto não passam pelo limite normal, só pelo máximo.
 */
export function classifyReport(
  price: number,
  referencePrice: number | null,
  isPromotion: boolean,
  params: ClassificationParams,
): Classification {
  if (referencePrice === null) {
    return { status: 'valido', deviationPct: null };
  }
  const deviationPct =
    Math.round((Math.abs(price - referencePrice) / referencePrice) * 10_000) /
    100;

  if (deviationPct > params.maxPct)
    return { status: 'rejeitado', deviationPct };
  if (deviationPct > params.normalPct && !isPromotion) {
    return { status: 'suspeito', deviationPct };
  }
  return { status: 'valido', deviationPct };
}

export interface ReportForDisplay {
  price: number;
  source: PriceSource;
  status: PriceReportStatus;
  reporterUserId: string | null;
  reportedAt: Date;
  promotion: { label: string; startsAt: Date; endsAt: Date } | null;
}

export interface DisplayParams {
  confirmationWindowHours: number;
  confirmationsRequired: number;
  staleAfterDays: number;
  hideAfterDays: number;
}

export interface DisplayedPrice {
  price: number;
  badge: PriceBadge;
  stale: boolean;
  updatedAt: Date;
  promotion: { label: string; endsAt: Date } | null;
}

/**
 * Preço exibido para um combustível de um posto (ADR 0003 e 0006), a partir
 * dos informes desse combustível:
 *
 * 1. Promoção vigente do posto vale sobre tudo.
 * 2. Com preço do posto, um valor de motoristas só o substitui se for
 *    posterior e confirmado por pessoas diferentes.
 * 3. Sem preço do posto, vale o mais recente entre o valor confirmado e o
 *    último informe válido de um motorista.
 *
 * Informes suspeitos de motoristas só aparecem quando confirmados; os do
 * posto aparecem. Rejeitados nunca aparecem.
 */
export function computeCurrentPrice(
  reports: ReportForDisplay[],
  now: Date,
  params: DisplayParams,
): DisplayedPrice | null {
  const usable = reports
    .filter((r) => r.status !== 'rejeitado' && r.reportedAt <= now)
    .sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());

  const promotion = usable.find(
    (r) =>
      r.promotion && r.promotion.startsAt <= now && now < r.promotion.endsAt,
  );
  if (promotion?.promotion) {
    return {
      price: promotion.price,
      badge: 'promocao',
      stale: false,
      updatedAt: promotion.reportedAt,
      promotion: {
        label: promotion.promotion.label,
        endsAt: promotion.promotion.endsAt,
      },
    };
  }

  const regular = usable.filter(
    (r) =>
      !r.promotion &&
      now.getTime() - r.reportedAt.getTime() <= params.hideAfterDays * DAY_MS,
  );
  const fromStation = regular.find((r) => r.source === 'posto');
  const fromDrivers = regular.filter((r) => r.source === 'usuario');
  const confirmed = latestConfirmed(fromDrivers, params);
  const single = fromDrivers.find((r) => r.status === 'valido');

  let chosen: { price: number; badge: PriceBadge; at: Date } | null = null;
  if (fromStation) {
    chosen =
      confirmed && confirmed.at > fromStation.reportedAt
        ? { ...confirmed, badge: 'confirmado_motoristas' }
        : {
            price: fromStation.price,
            badge: 'atualizado_posto',
            at: fromStation.reportedAt,
          };
  } else if (confirmed && (!single || confirmed.at >= single.reportedAt)) {
    chosen = { ...confirmed, badge: 'confirmado_motoristas' };
  } else if (single) {
    chosen = {
      price: single.price,
      badge: 'informado_motorista',
      at: single.reportedAt,
    };
  }
  if (!chosen) return null;

  return {
    price: chosen.price,
    badge: chosen.badge,
    stale: now.getTime() - chosen.at.getTime() > params.staleAfterDays * DAY_MS,
    updatedAt: chosen.at,
    promotion: null,
  };
}

/**
 * Valor mais recente informado por pessoas diferentes dentro da janela de
 * confirmação. `at` é o momento do informe mais recente do grupo.
 */
function latestConfirmed(
  drivers: ReportForDisplay[],
  params: DisplayParams,
): { price: number; at: Date } | null {
  const windowMs = params.confirmationWindowHours * HOUR_MS;
  for (const anchor of drivers) {
    const reporters = new Set(
      drivers
        .filter(
          (r) =>
            samePrice(r.price, anchor.price) &&
            r.reportedAt <= anchor.reportedAt &&
            anchor.reportedAt.getTime() - r.reportedAt.getTime() <= windowMs,
        )
        .map((r) => r.reporterUserId),
    );
    if (reporters.size >= params.confirmationsRequired) {
      return { price: anchor.price, at: anchor.reportedAt };
    }
  }
  return null;
}

function samePrice(a: number, b: number): boolean {
  return Math.round(a * 1000) === Math.round(b * 1000);
}
