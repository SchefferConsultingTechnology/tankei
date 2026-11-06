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
  /** Peso na confirmação (0 a 1, ADR 0024). Informes anteriores à regra: 1. */
  weight: number;
  promotion: { label: string; startsAt: Date; endsAt: Date } | null;
}

export interface DisplayParams {
  confirmationWindowHours: number;
  confirmationsRequired: number;
  staleAfterDays: number;
  hideAfterDays: number;
  divergenceResponseHours: number;
}

export interface DisplayedPrice {
  price: number;
  badge: PriceBadge;
  stale: boolean;
  updatedAt: Date;
  promotion: { label: string; endsAt: Date } | null;
  /** Consumidores confirmaram outro valor; o posto ainda pode responder. */
  divergence: { price: number; reportedAt: Date; respondBy: Date } | null;
  /** Consumidores informaram também outro valor recentemente. */
  otherValueReported: boolean;
}

/**
 * Preço exibido para um combustível de um posto (ADR 0003, 0006, 0020 e 0024),
 * a partir dos informes desse combustível. Informes em moderação ou anulados
 * já chegam fora da lista.
 *
 * 1. Promoção vigente do posto vale sobre tudo.
 * 2. Com preço do posto, um valor confirmado por consumidores depois dele
 *    abre uma divergência: o posto tem um prazo para reconfirmar (novo preço
 *    do posto) ou contestar; sem resposta, vale o valor dos consumidores.
 * 3. Sem preço do posto, entre os consumidores vence o valor com mais pessoas
 *    diferentes (contadas com o peso de cada informe); empate, o mais recente.
 *
 * Informes suspeitos de consumidores só aparecem quando confirmados; os do
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
      divergence: null,
      otherValueReported: false,
    };
  }

  const regular = usable.filter(
    (r) =>
      !r.promotion &&
      now.getTime() - r.reportedAt.getTime() <= params.hideAfterDays * DAY_MS,
  );
  const fromStation = regular.find((r) => r.source === 'posto');
  const consumers = regular.filter((r) => r.source === 'usuario');

  let chosen: { price: number; badge: PriceBadge; at: Date } | null = null;
  let divergence: DisplayedPrice['divergence'] = null;
  let otherValueReported = false;

  if (fromStation) {
    const after = consumers.filter(
      (r) => r.reportedAt > fromStation.reportedAt,
    );
    const pick = pickConsumerValue(after, params);
    const stationPrice = {
      price: fromStation.price,
      badge: 'atualizado_posto' as const,
      at: fromStation.reportedAt,
    };
    if (pick?.confirmedAt && samePrice(pick.price, fromStation.price)) {
      chosen = {
        price: pick.price,
        badge: 'confirmado_motoristas',
        at: pick.at,
      };
    } else if (pick?.confirmedAt) {
      const respondBy = new Date(
        pick.confirmedAt.getTime() + params.divergenceResponseHours * HOUR_MS,
      );
      if (now < respondBy) {
        chosen = stationPrice;
        divergence = { price: pick.price, reportedAt: pick.at, respondBy };
      } else {
        chosen = {
          price: pick.price,
          badge: 'confirmado_motoristas',
          at: pick.at,
        };
      }
    } else {
      chosen = stationPrice;
    }
    otherValueReported =
      !divergence &&
      after.some(
        (r) => r.status === 'valido' && !samePrice(r.price, chosen!.price),
      );
  } else {
    const pick = pickConsumerValue(consumers, params);
    if (pick) {
      chosen = {
        price: pick.price,
        badge: pick.confirmedAt
          ? 'confirmado_motoristas'
          : 'informado_motorista',
        at: pick.at,
      };
      otherValueReported = pick.otherValues;
    }
  }
  if (!chosen) return null;

  return {
    price: chosen.price,
    badge: chosen.badge,
    stale: now.getTime() - chosen.at.getTime() > params.staleAfterDays * DAY_MS,
    updatedAt: chosen.at,
    promotion: null,
    divergence,
    otherValueReported,
  };
}

interface ConsumerPick {
  price: number;
  /** Informe mais recente do valor na janela. */
  at: Date;
  /** Quando a soma dos pesos atingiu o necessário; nulo se não confirmado. */
  confirmedAt: Date | null;
  /** Havia outro valor na mesma janela. */
  otherValues: boolean;
}

/**
 * Valor dos consumidores (ADR 0020 e 0024). Partindo do informe mais recente,
 * olha a janela de confirmação até ele e agrupa por valor. Um valor concorre
 * se foi confirmado (soma dos pesos de pessoas diferentes) ou tem um informe
 * válido. Vence o de maior soma; empate, o mais recente. Sem candidato, a
 * janela recua para o informe anterior.
 */
export function pickConsumerValue(
  consumers: ReportForDisplay[],
  params: Pick<
    DisplayParams,
    'confirmationWindowHours' | 'confirmationsRequired'
  >,
): ConsumerPick | null {
  const windowMs = params.confirmationWindowHours * HOUR_MS;
  const sorted = [...consumers].sort(
    (a, b) => b.reportedAt.getTime() - a.reportedAt.getTime(),
  );
  for (const anchor of sorted) {
    const window = sorted.filter(
      (r) =>
        r.reportedAt <= anchor.reportedAt &&
        anchor.reportedAt.getTime() - r.reportedAt.getTime() <= windowMs,
    );
    const groups = new Map<number, ReportForDisplay[]>();
    for (const r of window) {
      const key = Math.round(r.price * 1000);
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const candidates = [...groups.values()].map((group) => {
      const confirmedAt = confirmationTime(group, params.confirmationsRequired);
      return {
        price: group[0].price,
        at: group[0].reportedAt,
        score: weightedReporters(group),
        confirmedAt,
        eligible:
          confirmedAt !== null || group.some((r) => r.status === 'valido'),
      };
    });
    const eligible = candidates
      .filter((c) => c.eligible)
      .sort((a, b) => b.score - a.score || b.at.getTime() - a.at.getTime());
    if (eligible.length > 0) {
      const [winner] = eligible;
      return {
        price: winner.price,
        at: winner.at,
        confirmedAt: winner.confirmedAt,
        otherValues: candidates.length > 1,
      };
    }
  }
  return null;
}

/** Soma dos pesos de pessoas diferentes (cada pessoa conta pelo maior peso). */
export function weightedReporters(reports: ReportForDisplay[]): number {
  const byPerson = new Map<string, number>();
  reports.forEach((r, index) => {
    const who = r.reporterUserId ?? `anonimo-${index}`;
    byPerson.set(who, Math.max(byPerson.get(who) ?? 0, r.weight));
  });
  let total = 0;
  for (const weight of byPerson.values()) total += weight;
  return Math.round(total * 100) / 100;
}

/** Momento em que a soma dos pesos atingiu o necessário (informes em ordem). */
function confirmationTime(
  group: ReportForDisplay[],
  required: number,
): Date | null {
  const ascending = [...group].sort(
    (a, b) => a.reportedAt.getTime() - b.reportedAt.getTime(),
  );
  for (let i = 0; i < ascending.length; i++) {
    if (weightedReporters(ascending.slice(0, i + 1)) >= required) {
      return ascending[i].reportedAt;
    }
  }
  return null;
}

export function samePrice(a: number, b: number): boolean {
  return Math.round(a * 1000) === Math.round(b * 1000);
}

/**
 * Peso do informe de um consumidor na confirmação (ADR 0024): conta ainda
 * não confiável não confirma o informe de outra pessoa (0); no posto vale 1;
 * longe do posto ou sem localização, o peso configurado.
 */
export function reportWeight(
  trusted: boolean,
  atStation: boolean | null,
  awayWeightPct: number,
): number {
  if (!trusted) return 0;
  return atStation ? 1 : awayWeightPct / 100;
}

/** Distância em metros entre dois pontos (haversine). */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
