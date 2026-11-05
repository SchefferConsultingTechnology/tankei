import { CONFIDENCE_LABELS } from '@tankei/shared';
import { useReputation } from '../api/queries';

/** IQP do posto por dimensão comparado à média da cidade (ADR 0012). */
export function ReputationTab({ stationId }: { stationId: string }) {
  const reputation = useReputation(stationId);

  if (reputation.isPending) return <p className="muted">Carregando…</p>;
  if (reputation.isError) {
    return <p className="error">{reputation.error.message}</p>;
  }
  const { station, city } = reputation.data;
  const cityByDimension = new Map(
    city.dimensions.map((d) => [d.dimension, d.score]),
  );

  return (
    <div className="stack">
      <h2 className="section-title">Reputação (IQP)</h2>
      <div className="stats">
        <div className="card stat">
          <div className="muted">IQP do seu posto</div>
          <div className="value">{station.score ?? '—'}</div>
          <div className="muted">
            {station.score == null
              ? `Dados insuficientes (${station.reviewers} ${station.reviewers === 1 ? 'avaliação' : 'avaliações'})`
              : `${station.confidence ? CONFIDENCE_LABELS[station.confidence] : ''} · ${station.reviewers} ${station.reviewers === 1 ? 'pessoa avaliou' : 'pessoas avaliaram'}`}
          </div>
        </div>
        <div className="card stat">
          <div className="muted">Média da cidade</div>
          <div className="value">{city.score ?? '—'}</div>
          <div className="muted">
            {city.stations === 0
              ? 'Nenhum posto da cidade tem nota ainda'
              : `${city.stations} ${city.stations === 1 ? 'posto com nota' : 'postos com nota'}`}
          </div>
        </div>
      </div>

      <section className="card stack">
        <strong>Por dimensão</strong>
        <div className="row muted" style={{ gap: 16 }}>
          <span className="row" style={{ gap: 6 }}>
            <span className="bar" style={{ width: 24 }}>
              <span style={{ width: '100%' }} />
            </span>
            Seu posto
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="bar city" style={{ width: 24 }}>
              <span style={{ width: '100%' }} />
            </span>
            Média da cidade
          </span>
        </div>
        <ul className="list">
          {station.dimensions.map((d) => {
            const cityScore = cityByDimension.get(d.dimension) ?? null;
            return (
              <li key={d.dimension} className="stack" style={{ gap: 6 }}>
                <div className="row">
                  <span className="grow">{d.label}</span>
                  <span className="muted">peso {d.weight}%</span>
                </div>
                <Bar label="Seu posto" score={d.score} />
                <Bar label="Média da cidade" score={cityScore} city />
              </li>
            );
          })}
        </ul>
      </section>

      <p className="muted">
        O IQP é calculado pelo Tankei a partir das avaliações dos consumidores,
        com a metodologia {station.methodologyVersion}. Preço não entra na nota,
        e nenhum plano pago a altera.
      </p>
    </div>
  );
}

function Bar({
  label,
  score,
  city = false,
}: {
  label: string;
  score: number | null;
  city?: boolean;
}) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <div
        className={`bar grow${city ? ' city' : ''}`}
        role="img"
        aria-label={`${label}: ${score ?? 'sem nota'}`}
      >
        {score != null && <span style={{ width: `${score}%` }} />}
      </div>
      <span className="muted" style={{ width: 32, textAlign: 'right' }}>
        {score ?? '—'}
      </span>
    </div>
  );
}
