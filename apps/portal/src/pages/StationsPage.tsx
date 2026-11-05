import type { Me } from '@tankei/shared';
import { Link, Navigate } from 'react-router';

/** Postos que a pessoa gerencia. Com um só, vai direto para ele. */
export function StationsPage({ user }: { user: Me }) {
  const stations = user.managedStations;

  if (stations.length === 1) {
    return <Navigate to={`/postos/${stations[0].id}`} replace />;
  }

  if (stations.length === 0) {
    return (
      <section className="card stack">
        <h1 className="page-title">
          Olá{user.name ? `, ${user.name.split(' ')[0]}` : ''}!
        </h1>
        <p>Sua conta ainda não está vinculada a nenhum posto.</p>
        <p className="muted">
          Para liberar o acesso, a equipe Tankei confirma com você que responde
          pelo posto. Entre em contato e informe o e-mail desta conta
          {user.email ? ` (${user.email})` : ''}.
        </p>
      </section>
    );
  }

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
    </section>
  );
}
