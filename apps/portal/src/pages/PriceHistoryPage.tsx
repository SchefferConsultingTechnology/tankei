import {
  FUEL_LABELS,
  FUEL_TYPES,
  formatPrice,
  formatUntil,
  type FuelType,
  type PriceHistoryEntry,
  type PriceReportStatus,
} from '@tankei/shared';
import { useState } from 'react';
import { usePriceHistory } from '../api/queries';
import { useStationContext } from './station-context';

const PERIODS = [7, 30, 90] as const;

const STATUS: Record<PriceReportStatus, { label: string; color: string }> = {
  valido: { label: 'Válido', color: 'var(--success)' },
  suspeito: {
    label: 'Suspeito',
    color: 'var(--badge-informado_motorista)',
  },
  rejeitado: { label: 'Rejeitado', color: 'var(--danger)' },
};

/**
 * Histórico dos informes de preço do posto (ADR 0020): do posto e dos
 * consumidores, com a situação e qual define o preço exibido agora.
 */
export function PriceHistoryPage() {
  const { station } = useStationContext();
  const [fuel, setFuel] = useState<FuelType | null>(null);
  const [days, setDays] = useState<number>(30);
  const history = usePriceHistory(station.id, fuel, days);
  const fuels = FUEL_TYPES.filter((f) => station.fuels.includes(f));

  return (
    <div className="stack">
      <h2 className="section-title">Histórico de preços</h2>

      <div className="fuel-chips" role="group" aria-label="Combustível">
        <button
          type="button"
          aria-pressed={fuel === null}
          onClick={() => setFuel(null)}
        >
          Todos
        </button>
        {fuels.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={fuel === f}
            onClick={() => setFuel(f)}
          >
            {FUEL_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="segmented" role="radiogroup" aria-label="Período">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={days === p}
            onClick={() => setDays(p)}
          >
            {p} dias
          </button>
        ))}
      </div>

      {history.isPending && <p className="muted">Carregando…</p>}
      {history.isError && <p className="error">{history.error.message}</p>}
      {history.data && history.data.entries.length === 0 && (
        <p className="card muted">Nenhum preço informado no período.</p>
      )}
      {history.data && history.data.entries.length > 0 && (
        <ul className="list card">
          {history.data.entries.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} showFuel={fuel === null} />
          ))}
        </ul>
      )}

      <p className="muted">
        Consumidores aparecem com um apelido (o mesmo para a mesma pessoa neste
        posto), sem nome. Informes suspeitos só entram no preço depois de
        confirmados; rejeitados nunca entram. Nada é apagado: correções criam um
        registro novo.
      </p>
    </div>
  );
}

function HistoryRow({
  entry,
  showFuel,
}: {
  entry: PriceHistoryEntry;
  showFuel: boolean;
}) {
  const status = STATUS[entry.status];
  const when = new Date(entry.reportedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className={entry.current ? 'row highlight' : 'row'}>
      <div className="grow">
        <div className="row wrap" style={{ gap: 8 }}>
          <strong className="nowrap">R$ {formatPrice(entry.price)}</strong>
          {showFuel && (
            <span className="muted">{FUEL_LABELS[entry.fuelType]}</span>
          )}
          {entry.current && <span className="tag">Em vigor</span>}
        </div>
        <div className="muted truncate">
          {when} · {entry.reporter}
          {entry.promotion &&
            ` · Promoção “${entry.promotion.label}” ${formatUntil(entry.promotion.endsAt)}`}
        </div>
      </div>
      <span className="status" style={{ color: status.color }}>
        {status.label}
      </span>
    </li>
  );
}
