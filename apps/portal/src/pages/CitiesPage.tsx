import { BRAZIL_STATES, FUEL_LABELS, formatPrice } from '@tankei/shared';
import { useState } from 'react';
import { useCities, useCityComparison } from '../api/queries';
import { useStationContext } from './station-context';

const money = (value: number | null) =>
  value === null ? '—' : `R$ ${formatPrice(value)}`;

/** Preços de outra cidade comparados aos do posto (só dados públicos, ADR 0012). */
export function CitiesPage() {
  const { station } = useStationContext();
  const [state, setState] = useState<string>(station.state);
  const [municipality, setMunicipality] = useState('');
  const cities = useCities(state);
  const comparison = useCityComparison(station.id, municipality);

  return (
    <div className="stack">
      <h2 className="section-title">Comparar com outra cidade</h2>

      <div className="card stack">
        <div className="field">
          <label htmlFor="cmp-state">Estado</label>
          <select
            id="cmp-state"
            className="input"
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setMunicipality('');
            }}
          >
            {BRAZIL_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cmp-city">Cidade</label>
          <select
            id="cmp-city"
            className="input"
            value={municipality}
            onChange={(event) => setMunicipality(event.target.value)}
            disabled={!cities.data}
          >
            <option value="">
              {cities.isPending ? 'Carregando…' : 'Escolha a cidade'}
            </option>
            {cities.data?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.stations} {c.stations === 1 ? 'posto' : 'postos'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {comparison.isFetching && <p className="muted">Carregando…</p>}
      {comparison.isError && (
        <p className="error">{comparison.error.message}</p>
      )}
      {comparison.data && (
        <section className="card stack">
          <strong>
            {comparison.data.municipality.name}/
            {comparison.data.municipality.state}
          </strong>
          <ul className="list">
            {comparison.data.fuels.map((f) => (
              <li key={f.fuelType} className="stack" style={{ gap: 6 }}>
                <div className="row">
                  <strong className="grow">{FUEL_LABELS[f.fuelType]}</strong>
                  <span className="muted">
                    {f.stations === 0
                      ? 'Sem preços nesta cidade'
                      : `${f.stations} ${f.stations === 1 ? 'posto' : 'postos'} com preço`}
                  </span>
                </div>
                {f.stations > 0 && (
                  <div className="compare-grid">
                    <span className="muted">Seu preço</span>
                    <span className="muted">Menor</span>
                    <span className="muted">Média</span>
                    <span className="muted">Mediana</span>
                    <strong>{money(f.ownPrice)}</strong>
                    <span>{money(f.min)}</span>
                    <span>{money(f.average)}</span>
                    <span>{money(f.median)}</span>
                  </div>
                )}
                {f.positionThere && (
                  <span className="muted">
                    Com o seu preço, o posto seria o {f.positionThere.position}º
                    de {f.positionThere.total} nessa cidade, contando o seu (1º = mais barato).
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="muted">
        Só entram preços vigentes que o app mostra aos consumidores.
      </p>
    </div>
  );
}
