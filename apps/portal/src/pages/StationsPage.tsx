import { ORG_ROLE_LABELS, roleCan, type Me } from '@tankei/shared';
import { Link, Navigate } from 'react-router';
import { useMyInvitations } from '../api/queries';
import { InvitationsBanner } from '../components/InvitationsBanner';
import { ClaimsPage } from './ClaimsPage';

/**
 * Início do portal (ADR 0021): convites pendentes primeiro; sem rede, os
 * pedidos de acesso; com uma rede, vai direto para ela (ou para a unidade);
 * com várias, a lista de redes.
 */
export function StationsPage({ user }: { user: Me }) {
  const invitations = useMyInvitations();
  const pending = invitations.data?.length ?? 0;
  const orgs = user.organizations;

  if (invitations.isPending) return <p className="muted">Carregando…</p>;

  if (orgs.length === 0) {
    // Com convite pendente, ele é o caminho; pedir acesso fica como opção.
    if (pending > 0) {
      return (
        <section className="stack">
          <InvitationsBanner />
          <Link to="/acesso">Ou peça acesso a outro posto</Link>
        </section>
      );
    }
    return <ClaimsPage user={user} />;
  }

  if (orgs.length === 1 && pending === 0) {
    const [org] = orgs;
    // Pelo que a pessoa enxerga (escopo), não pelo total da rede.
    const goToNetwork =
      org.stations.length > 1 || roleCan(org.role, 'manage_team');
    if (goToNetwork) return <Navigate to={`/redes/${org.id}`} replace />;
    if (org.stations[0]) {
      return <Navigate to={`/postos/${org.stations[0].id}/precos`} replace />;
    }
  }

  return (
    <section className="stack">
      <InvitationsBanner />
      <h1 className="page-title">Suas redes</h1>
      <ul className="list card">
        {orgs.map((org) => (
          <li key={org.id} className="row">
            <div className="grow">
              <Link to={`/redes/${org.id}`}>
                <strong>{org.name}</strong>
              </Link>
              <div className="muted">
                {ORG_ROLE_LABELS[org.role]} · {org.stations.length}{' '}
                {org.stations.length === 1 ? 'unidade' : 'unidades'}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Link to="/acesso">Pedir acesso a outro posto</Link>
    </section>
  );
}
