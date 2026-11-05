import {
  formatAge,
  formatPrice,
  FUEL_LABELS,
  roleCan,
  type BulkPriceResult,
  type FuelType,
  type OrganizationOverview,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { useBulkPrice, useOverview } from '../api/queries';
import { PriceTag } from '../components/PriceTag';
import { usePortalContext } from './station-context';

/** Visão da rede (ADR 0021): preço de cada unidade por combustível. */
export function NetworkOverviewPage() {
  const { org } = usePortalContext();
  const overview = useOverview(org.id);

  if (overview.isPending) return <p className="muted">Carregando…</p>;
  if (overview.isError)
    return <p className="error">{overview.error.message}</p>;
  const data = overview.data;
  const staleCount = data.stations.filter((s) =>
    s.prices.some((p) => p.stale),
  ).length;

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">{data.name}</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {data.stations.length}{' '}
          {data.stations.length === 1 ? 'unidade' : 'unidades'}
          {staleCount > 0 && ` · ${staleCount} com preço desatualizado`}
        </p>
      </div>

      {data.stations.length === 0 ? (
        <p className="card muted">Nenhuma unidade no seu escopo.</p>
      ) : (
        <section className="card table-scroll">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">Unidade</th>
                {data.fuels.map((fuel) => (
                  <th key={fuel} scope="col">
                    {FUEL_LABELS[fuel]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stations.map((s) => (
                <tr key={s.id}>
                  <th scope="row">
                    <Link to={`/postos/${s.id}/precos`}>{s.name}</Link>
                    <div className="muted">
                      {s.city}/{s.state}
                    </div>
                  </th>
                  {data.fuels.map((fuel) => {
                    if (!s.fuels.includes(fuel)) {
                      return (
                        <td key={fuel} className="muted" title="Não vende">
                          ·
                        </td>
                      );
                    }
                    const price = s.prices.find((p) => p.fuelType === fuel);
                    return (
                      <td key={fuel}>
                        <PriceTag price={price} />
                        {price && (
                          <div className="muted small">
                            {formatAge(price.updatedAt)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {roleCan(data.role, 'update_price') && data.stations.length > 1 && (
        <BulkPriceForm overview={data} />
      )}
    </div>
  );
}

/** Publicado, mas a promoção vigente continua valendo até acabar. */
function promotionNote(
  overview: OrganizationOverview,
  stationId: string,
  fuel: FuelType,
): string {
  const current = overview.stations
    .find((s) => s.id === stationId)
    ?.prices.find((p) => p.fuelType === fuel);
  return current?.promotion
    ? `Publicado · vale depois da promoção “${current.promotion.label}”`
    : 'Publicado';
}

function parsePrice(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Mesmo preço em várias unidades; cada uma segue as regras de um informe. */
function BulkPriceForm({ overview }: { overview: OrganizationOverview }) {
  const bulk = useBulkPrice(overview.id);
  const [fuel, setFuel] = useState<FuelType>(overview.fuels[0]);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkPriceResult | null>(null);
  const price = parsePrice(text);
  const eligible = overview.stations.filter((s) => s.fuels.includes(fuel));
  const chosen = eligible.filter((s) => selected.has(s.id)).map((s) => s.id);
  const needConfirm =
    result?.results.filter((r) => r.code === 'CONFIRMATION_REQUIRED') ?? [];

  function send(stationIds: string[], confirmed: boolean) {
    if (price === null || stationIds.length === 0) return;
    bulk.mutate(
      { fuelType: fuel, price, stationIds, confirmed },
      { onSuccess: setResult },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    send(chosen, false);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div>
        <strong>Atualizar preço em várias unidades</strong>
        <div className="muted">
          Cada unidade passa pelas mesmas regras de um preço informado
          individualmente.
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="field grow">
          <label htmlFor="bulk-fuel">Combustível</label>
          <select
            id="bulk-fuel"
            className="input"
            value={fuel}
            onChange={(event) => {
              setFuel(event.target.value as FuelType);
              setResult(null);
            }}
          >
            {overview.fuels.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="field grow">
          <label htmlFor="bulk-price">Novo preço (R$)</label>
          <input
            id="bulk-price"
            className="input"
            inputMode="decimal"
            placeholder="6,29"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>

      <fieldset className="checklist">
        <legend className="muted">Unidades</legend>
        <label className="row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={chosen.length === eligible.length && eligible.length > 0}
            onChange={(event) =>
              setSelected(
                event.target.checked
                  ? new Set(eligible.map((s) => s.id))
                  : new Set(),
              )
            }
          />
          <strong>Todas que vendem {FUEL_LABELS[fuel].toLowerCase()}</strong>
        </label>
        {eligible.map((s) => {
          const current = s.prices.find((p) => p.fuelType === fuel);
          return (
            <label key={s.id} className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
              />
              <span className="grow truncate">{s.name}</span>
              <span className="muted">
                {current
                  ? `hoje R$ ${formatPrice(current.price)}`
                  : 'sem preço'}
              </span>
            </label>
          );
        })}
      </fieldset>

      <button
        type="submit"
        className="button"
        disabled={price === null || chosen.length === 0 || bulk.isPending}
      >
        {bulk.isPending
          ? 'Publicando…'
          : `Publicar em ${chosen.length} ${chosen.length === 1 ? 'unidade' : 'unidades'}`}
      </button>

      {bulk.error && (
        <p className="error">
          {bulk.error instanceof ApiError
            ? bulk.error.message
            : 'Não foi possível publicar.'}
        </p>
      )}

      {result && (
        <ul className="list" aria-live="polite">
          {result.results.map((r) => (
            <li key={r.stationId} className="row">
              <span className="grow truncate">{r.name}</span>
              <span
                className="status wrap-ok"
                style={{
                  color: r.ok
                    ? 'var(--success)'
                    : r.code === 'CONFIRMATION_REQUIRED'
                      ? 'var(--badge-informado_motorista)'
                      : 'var(--danger)',
                }}
                title={r.message}
              >
                {r.ok
                  ? promotionNote(overview, r.stationId, fuel)
                  : r.code === 'CONFIRMATION_REQUIRED'
                    ? 'Confirmar valor'
                    : 'Não publicado'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result?.results.some(
        (r) => !r.ok && r.code !== 'CONFIRMATION_REQUIRED',
      ) && (
        <p className="muted">
          {result.results
            .filter((r) => !r.ok && r.code !== 'CONFIRMATION_REQUIRED')
            .map((r) => `${r.name}: ${r.message}`)
            .join(' · ')}
        </p>
      )}
      {needConfirm.length > 0 && (
        <div className="card stack" role="alert">
          <strong>Confira o valor</strong>
          <p style={{ margin: 0 }}>
            R$ {price !== null ? formatPrice(price) : ''} é muito diferente do
            preço atual em {needConfirm.map((r) => r.name).join(', ')}.
          </p>
          <button
            type="button"
            className="button"
            onClick={() =>
              send(
                needConfirm.map((r) => r.stationId),
                true,
              )
            }
          >
            Está correto, publicar nessas unidades
          </button>
        </div>
      )}
    </form>
  );
}
