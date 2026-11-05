import type { Me } from '@tankei/shared';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { useStation } from '../api/queries';
import { Layout } from '../components/Layout';
import type { StationContext } from './station-context';

/** Menu do posto: grupos com subitens (ADR 0020). */
const MENU: {
  label: string;
  items: { label: string; to: string; end?: boolean }[];
}[] = [
  {
    label: 'Preços',
    items: [
      { label: 'Atualizar preços', to: 'precos', end: true },
      { label: 'Histórico', to: 'precos/historico' },
    ],
  },
  {
    label: 'Concorrência',
    items: [
      { label: 'Região', to: 'concorrencia', end: true },
      { label: 'Outras cidades', to: 'concorrencia/cidades' },
      { label: 'Promoções', to: 'concorrencia/promocoes' },
    ],
  },
  {
    label: 'Reputação',
    items: [{ label: 'IQP por dimensão', to: 'reputacao' }],
  },
];

/** Moldura das telas de um posto: menu lateral e cabeçalho do posto. */
export function StationShell({ user }: { user: Me }) {
  const { id = '' } = useParams();
  const station = useStation(id);

  const sidebar = (
    <>
      <div className="sidebar-station">
        <strong className="truncate">{station.data?.name ?? 'Posto'}</strong>
        {user.managedStations.length > 1 && (
          <Link to="/" className="muted">
            Trocar de posto
          </Link>
        )}
      </div>
      {MENU.map((group) => (
        <div key={group.label} className="sidebar-group">
          <span className="sidebar-title">{group.label}</span>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={`/postos/${id}/${item.to}`}
              end={item.end}
              className="sidebar-link"
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="sidebar-group sidebar-footer">
        <NavLink to="/acesso" className="sidebar-link">
          Pedidos de acesso
        </NavLink>
      </div>
    </>
  );

  return (
    <Layout sidebar={sidebar}>
      {station.isPending && <p className="muted">Carregando…</p>}
      {station.isError && <p className="error">{station.error.message}</p>}
      {station.data && (
        <>
          <div>
            <h1 className="page-title">{station.data.name}</h1>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {station.data.brand} ·{' '}
              {[
                station.data.address,
                station.data.district,
                `${station.data.city}/${station.data.state}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <Outlet
            context={{ station: station.data } satisfies StationContext}
          />
        </>
      )}
    </Layout>
  );
}
