import { Link, useParams, useSearchParams } from 'react-router';
import { useStation } from '../api/queries';
import { CompetitionTab } from './CompetitionTab';
import { PricesTab } from './PricesTab';
import { ReputationTab } from './ReputationTab';

const TABS = [
  { id: 'precos', label: 'Preços' },
  { id: 'concorrencia', label: 'Concorrência' },
  { id: 'reputacao', label: 'Reputação' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Um posto no portal; a aba fica no endereço (?aba=), para voltar a ela. */
export function StationPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((t) => t.id === params.get('aba'))
    ? (params.get('aba') as TabId)
    : 'precos';
  const station = useStation(id);

  if (station.isPending) return <p className="muted">Carregando…</p>;
  if (station.isError) return <p className="error">{station.error.message}</p>;
  const data = station.data;

  return (
    <>
      <div>
        <h1 className="page-title">{data.name}</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {data.brand} ·{' '}
          {[data.address, data.district, `${data.city}/${data.state}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="segmented" role="tablist" aria-label="Seções do posto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ aba: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'precos' && <PricesTab station={data} />}
        {tab === 'concorrencia' && <CompetitionTab stationId={id} />}
        {tab === 'reputacao' && <ReputationTab stationId={id} />}
      </div>

      <p className="muted">
        Responde por outro posto? <Link to="/acesso">Peça acesso</Link>.
      </p>
    </>
  );
}
