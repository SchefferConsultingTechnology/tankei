import {
  describePrice,
  formatDistance,
  formatPrice,
  FUEL_LABELS,
  type FuelType,
} from '@tankei/shared';
import { useState } from 'react';
import { useCompetition } from '../api/queries';
import { PriceTag } from '../components/PriceTag';

/**
 * Concorrência local (ADR 0012): só o que o app já mostra publicamente, sem
 * sugestão de preço.
 */
export function CompetitionTab({ stationId }: { stationId: string }) {
  const [radius, setRadius] = useState<number | undefined>(undefined);
  const competition = useCompetition(stationId, radius);
  const [chosen, setChosen] = useState<FuelType | null>(null);

  if (competition.isPending) return <p className="muted">Carregando…</p>;
  if (competition.isError) {
    return <p className="error">{competition.error.message}</p>;
  }
  const { fuels, radiusMeters, maxRadiusMeters } = competition.data;
  if (fuels.length === 0) {
    return <p className="card muted">Sem combustíveis informados.</p>;
  }
  const current = fuels.find((f) => f.fuelType === chosen) ?? fuels[0];
  const reference = current.stateReference;

  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <h2 className="section-title grow">Concorrência na região</h2>
        <label className="row" style={{ gap: 8 }}>
          <span className="muted">Raio</span>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={radiusMeters}
            onChange={(event) => setRadius(Number(event.target.value))}
          >
            {radiusOptions(maxRadiusMeters).map((r) => (
              <option key={r} value={r}>
                até {formatDistance(r)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fuel-chips" role="group" aria-label="Combustível">
        {fuels.map((f) => (
          <button
            key={f.fuelType}
            type="button"
            aria-pressed={f.fuelType === current.fuelType}
            onClick={() => setChosen(f.fuelType)}
          >
            {FUEL_LABELS[f.fuelType]}
          </button>
        ))}
      </div>

      <div className="stats">
        <div className="card stat">
          <div className="muted">Seu preço</div>
          <div className="value">
            {current.price ? `R$ ${formatPrice(current.price.price)}` : '—'}
          </div>
          <div className="muted">
            {current.price
              ? describePrice(current.price)
              : 'Sem preço informado'}
          </div>
        </div>
        <div className="card stat">
          <div className="muted">Posição na cidade</div>
          <div className="value">
            {current.cityRank ? `${current.cityRank.position}º` : '—'}
          </div>
          <div className="muted">
            {current.cityRank
              ? `de ${current.cityRank.total} ${current.cityRank.total === 1 ? 'posto' : 'postos'} com preço (1º = mais barato)`
              : 'Informe seu preço para ver a posição'}
          </div>
        </div>
        <div className="card stat">
          <div className="muted">Média da ANP no estado</div>
          <div className="value">
            {reference ? `R$ ${formatPrice(reference.averagePrice)}` : '—'}
          </div>
          <div className="muted">
            {reference
              ? `Semana de ${new Date(`${reference.weekStart}T12:00`).toLocaleDateString('pt-BR')}${
                  reference.referenceFuel !== current.fuelType
                    ? ` (${FUEL_LABELS[reference.referenceFuel].toLowerCase()})`
                    : ''
                }`
              : 'Sem pesquisa da ANP para este combustível'}
          </div>
        </div>
      </div>

      <section className="card stack">
        <div>
          <strong>Postos a até {formatDistance(radiusMeters)}</strong>
          <div className="muted">
            {FUEL_LABELS[current.fuelType]}, do mais barato ao mais caro. Só
            aparecem postos com preço vigente no app.
          </div>
        </div>
        {current.nearby.length === 0 ? (
          <p className="muted">Nenhum posto próximo com preço informado.</p>
        ) : (
          <ul className="list">
            {mergeOwn(current).map((row) => (
              <li key={row.key} className={row.own ? 'row highlight' : 'row'}>
                <div className="grow">
                  <div className="truncate">
                    <strong>{row.name}</strong>
                  </div>
                  <div className="muted truncate">{row.detail}</div>
                </div>
                <PriceTag price={row.price} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type Current = NonNullable<
  ReturnType<typeof useCompetition>['data']
>['fuels'][number];

/** Lista dos concorrentes com o próprio posto na posição pelo preço. */
function mergeOwn(fuel: Current) {
  const rows = fuel.nearby.map((c) => ({
    key: c.id,
    own: false,
    name: c.name,
    detail: `${c.brand} · ${formatDistance(c.distanceMeters)} · ${describePrice(c.price)}`,
    price: c.price,
  }));
  if (!fuel.price) return rows;
  const own = {
    key: 'own',
    own: true,
    name: 'Seu posto',
    detail: describePrice(fuel.price),
    price: fuel.price,
  };
  const index = rows.findIndex((r) => r.price.price > fuel.price!.price);
  rows.splice(index === -1 ? rows.length : index, 0, own);
  return rows;
}

/** Opções de raio até o máximo do parâmetro (o máximo sempre aparece). */
function radiusOptions(max: number): number[] {
  const steps = [1000, 2000, 3000, 5000, 10_000, 20_000, 50_000];
  return [...new Set([...steps.filter((r) => r < max), max])];
}
