import { ORG_ROLE_LABELS, roleCan, type Me } from '@tankei/shared';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
import { useStation } from '../api/queries';
import { Layout } from '../components/Layout';
import type { PortalContext } from './station-context';

/** Telas de uma unidade, na ordem do menu (o caminho é relativo a /postos/:id). */
const UNIT_MENU = [
  {
    label: 'Preços',
    items: [
      { label: 'Preços atuais', to: 'precos', end: true },
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

/**
 * Moldura do portal (ADR 0021): menu com a rede (visão geral, equipe) e a
 * unidade escolhida (preços, concorrência, reputação). Serve tanto
 * /redes/:orgId quanto /postos/:id.
 */
export function PortalShell({ user }: { user: Me }) {
  const { id: stationId, orgId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const station = useStation(stationId ?? '');

  const access = stationId
    ? user.managedStations.find((s) => s.id === stationId)
    : undefined;
  const org = user.organizations.find(
    (o) => o.id === (orgId ?? access?.organizationId),
  );

  // Sem acesso à unidade ou à rede pedida: volta ao início.
  if (!org || (stationId && !access)) return <Navigate to="/" replace />;
  const role = access?.role ?? org.role;
  const currentUnit = stationId ?? org.stations[0]?.id;
  // Pelo que a pessoa enxerga (escopo), não pelo total da rede.
  const showNetwork =
    org.stations.length > 1 || roleCan(org.role, 'manage_team');
  // Na tela da rede, os itens da unidade só aparecem depois de escolher uma.
  const showUnitMenu = Boolean(stationId) || org.stations.length === 1;

  /** Troca de unidade mantendo a tela (ex.: histórico da outra unidade). */
  function switchUnit(next: string) {
    const rest = stationId
      ? (location.pathname.split(`/postos/${stationId}/`)[1] ?? 'precos')
      : 'precos';
    navigate(`/postos/${next}/${rest}`);
  }

  const sidebar = (
    <>
      <div className="sidebar-station">
        <strong className="truncate">{org.name}</strong>
        <span className="muted">{ORG_ROLE_LABELS[org.role]}</span>
        {user.organizations.length > 1 && (
          <Link to="/" className="muted">
            Trocar de rede
          </Link>
        )}
      </div>

      {showNetwork && (
        <div className="sidebar-group">
          <span className="sidebar-title">Rede</span>
          <NavLink to={`/redes/${org.id}`} end className="sidebar-link">
            Visão geral
          </NavLink>
          {roleCan(org.role, 'manage_team') && (
            <NavLink to={`/redes/${org.id}/equipe`} className="sidebar-link">
              Equipe
            </NavLink>
          )}
        </div>
      )}

      {currentUnit && (
        <div className="sidebar-group">
          <span className="sidebar-title">Unidade</span>
          {org.stations.length > 1 ? (
            <select
              className="input sidebar-select"
              aria-label="Unidade"
              value={stationId ?? ''}
              onChange={(event) => switchUnit(event.target.value)}
            >
              {!stationId && <option value="">Escolha a unidade</option>}
              {org.stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="sidebar-unit truncate">
              {org.stations[0]?.name}
            </span>
          )}
        </div>
      )}

      {currentUnit &&
        showUnitMenu &&
        UNIT_MENU.map((group) => (
          <div key={group.label} className="sidebar-group">
            <span className="sidebar-title">{group.label}</span>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={`/postos/${currentUnit}/${item.to}`}
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

  const context: PortalContext = {
    org,
    role,
    station: stationId ? (station.data ?? null) : null,
  };

  return (
    <Layout sidebar={sidebar}>
      {stationId && station.isPending && <p className="muted">Carregando…</p>}
      {stationId && station.isError && (
        <p className="error">{station.error.message}</p>
      )}
      {stationId && station.data && (
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
      )}
      {(!stationId || station.data) && <Outlet context={context} />}
    </Layout>
  );
}
