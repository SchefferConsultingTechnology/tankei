import type { Me } from '@tankei/shared';
import { Link, Navigate } from 'react-router';
import { ClaimsPage } from './ClaimsPage';

/** Postos que a pessoa gerencia. Com um só, vai direto para ele. */
export function StationsPage({ user }: { user: Me }) {
  const stations = user.managedStations;

  if (stations.length === 1) {
    return <Navigate to={`/postos/${stations[0].id}`} replace />;
  }

  // Sem posto: a tela inicial é a dos pedidos de acesso (ADR 0019).
  if (stations.length === 0) return <ClaimsPage user={user} />;

  return (
    <section className="stack">
      <h1 className="page-title">Seus postos</h1>
      <ul className="list card">
        {stations.map((station) => (
          <li key={station.id}>
            <Link to={`/postos/${station.id}`}>{station.name}</Link>
          </li>
        ))}
      </ul>
      <Link to="/acesso">Pedir acesso a outro posto</Link>
    </section>
  );
}
