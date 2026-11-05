import {
  CLAIM_POSITION_LABELS,
  CLAIM_STATUS_LABELS,
  type Claim,
  type Me,
} from '@tankei/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMyClaims } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { ClaimForm } from './ClaimForm';

const STATUS_COLOR: Record<Claim['status'], string> = {
  em_analise: 'var(--badge-informado_motorista)',
  aprovado: 'var(--success)',
  recusado: 'var(--danger)',
};

/**
 * Pedidos de posto da pessoa e o formulário para pedir um novo (ADR 0019).
 * É a tela inicial de quem ainda não gerencia nenhum posto.
 */
export function ClaimsPage({ user }: { user: Me }) {
  const claims = useMyClaims();
  const { refreshUser } = useAuth();
  const [creating, setCreating] = useState(false);
  const [sent, setSent] = useState(false);
  const managed = new Set(user.managedStations.map((s) => s.id));

  // Pedido aprovado depois do login: recarrega a conta para o posto aparecer.
  const approvedNotLoaded = claims.data?.some(
    (c) => c.status === 'aprovado' && !managed.has(c.station.id),
  );
  useEffect(() => {
    if (approvedNotLoaded) void refreshUser().catch(() => undefined);
  }, [approvedNotLoaded, refreshUser]);

  if (creating) {
    return (
      <ClaimForm
        user={user}
        onCancel={() => setCreating(false)}
        onSent={() => {
          setCreating(false);
          setSent(true);
        }}
      />
    );
  }

  const first = user.name?.split(' ')[0];
  const list = claims.data ?? [];

  return (
    <section className="stack">
      <h1 className="page-title">
        {user.managedStations.length === 0
          ? `Olá${first ? `, ${first}` : ''}!`
          : 'Pedidos de acesso'}
      </h1>

      {sent && (
        <p className="card" role="status" style={{ color: 'var(--success)' }}>
          Pedido enviado. A equipe Tankei vai ligar para confirmar que você
          responde pelo posto; depois disso, o acesso é liberado aqui.
        </p>
      )}

      {user.managedStations.length === 0 && list.length === 0 && (
        <div className="card stack">
          <p style={{ margin: 0 }}>
            Para usar o portal, peça acesso ao posto que você administra.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Você encontra o posto pelo CNPJ ou pelo nome. A equipe Tankei
            confirma por telefone que você responde por ele e libera o acesso.
          </p>
        </div>
      )}

      {claims.isError && <p className="error">{claims.error.message}</p>}

      {list.length > 0 && (
        <ul className="list card">
          {list.map((claim) => (
            <li key={claim.id} className="stack" style={{ gap: 4 }}>
              <div className="row">
                <strong className="grow truncate">{claim.station.name}</strong>
                <span
                  className="price-tag"
                  style={{ color: STATUS_COLOR[claim.status], fontSize: 13 }}
                >
                  {CLAIM_STATUS_LABELS[claim.status]}
                </span>
              </div>
              <div className="muted">
                {claim.station.cnpj} · {claim.station.city}/
                {claim.station.state} · {CLAIM_POSITION_LABELS[claim.position]}{' '}
                · pedido em{' '}
                {new Date(claim.createdAt).toLocaleDateString('pt-BR')}
              </div>
              {claim.status === 'recusado' && claim.reason && (
                <div className="muted">Motivo: {claim.reason}</div>
              )}
              {claim.status === 'aprovado' && managed.has(claim.station.id) && (
                <Link to={`/postos/${claim.station.id}`}>Abrir o posto</Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="button"
        onClick={() => {
          setCreating(true);
          setSent(false);
        }}
      >
        {user.managedStations.length === 0 && list.length === 0
          ? 'Reivindicar meu posto'
          : 'Pedir acesso a outro posto'}
      </button>

      {user.managedStations.length > 0 && (
        <Link to="/">Voltar aos meus postos</Link>
      )}
    </section>
  );
}
