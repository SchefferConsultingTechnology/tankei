import {
  CLAIM_POSITION_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUSES,
  VERIFICATION_METHOD_LABELS,
  type AdminClaim,
  type ClaimStatus,
  type VerificationMethod,
} from '@tankei/shared';
import { useState } from 'react';
import { ApiError } from '../api/client';
import { useClaims, useDecideClaim } from '../api/queries';

/** Formas que o administrador registra à mão (e-CNPJ e carta virão automáticas). */
const MANUAL_METHODS: VerificationMethod[] = [
  'telefone',
  'presencial',
  'documentos',
];

function formatPhone(digits: string): string {
  return digits.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
}

/** Fila de pedidos de acesso a postos (ADR 0019). */
export function ClaimsQueuePage() {
  const [status, setStatus] = useState<ClaimStatus>('em_analise');
  const claims = useClaims(status);

  return (
    <section className="stack">
      <h1 className="page-title">Pedidos de acesso a postos</h1>
      <div className="segmented" role="tablist" aria-label="Situação">
        {CLAIM_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
          >
            {CLAIM_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {claims.isPending && <p className="muted">Carregando…</p>}
      {claims.isError && <p className="error">{claims.error.message}</p>}
      {claims.isSuccess && claims.data.length === 0 && (
        <p className="card muted">
          {status === 'em_analise'
            ? 'Nenhum pedido aguardando análise.'
            : 'Nenhum pedido nesta situação.'}
        </p>
      )}
      {claims.data?.map((claim) => (
        <ClaimCard key={claim.id} claim={claim} />
      ))}
    </section>
  );
}

function ClaimCard({ claim }: { claim: AdminClaim }) {
  const decide = useDecideClaim();
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [method, setMethod] = useState<VerificationMethod>('telefone');
  const [reason, setReason] = useState('');
  const pending = claim.status === 'em_analise';

  const error =
    decide.error instanceof ApiError
      ? decide.error.message
      : decide.error
        ? 'Não foi possível registrar a decisão.'
        : null;

  return (
    <article className="card stack">
      <div>
        <strong>{claim.station.name}</strong>
        <div className="muted">
          {claim.station.legalName} · CNPJ {claim.station.cnpj}
        </div>
        <div className="muted">
          {claim.station.brand} · {claim.station.address} · {claim.station.city}
          /{claim.station.state}
        </div>
      </div>

      <dl className="facts">
        <dt>Contato</dt>
        <dd>
          {claim.contactName ?? '(conta excluída)'} ·{' '}
          {CLAIM_POSITION_LABELS[claim.position]}
        </dd>
        <dt>Telefone</dt>
        <dd>
          {claim.phone ? (
            <a href={`tel:+55${claim.phone}`}>{formatPhone(claim.phone)}</a>
          ) : (
            '—'
          )}
        </dd>
        <dt>Conta</dt>
        <dd>
          {claim.account.name ?? 'Sem nome'}
          {claim.account.email ? ` · ${claim.account.email}` : ''}
        </dd>
        <dt>Pedido em</dt>
        <dd>{new Date(claim.createdAt).toLocaleString('pt-BR')}</dd>
        {claim.message && (
          <>
            <dt>Observação</dt>
            <dd>{claim.message}</dd>
          </>
        )}
        {claim.decidedAt && (
          <>
            <dt>{CLAIM_STATUS_LABELS[claim.status]} em</dt>
            <dd>
              {new Date(claim.decidedAt).toLocaleString('pt-BR')}
              {claim.verificationMethod &&
                ` · ${VERIFICATION_METHOD_LABELS[claim.verificationMethod]}`}
            </dd>
          </>
        )}
        {claim.reason && (
          <>
            <dt>Motivo</dt>
            <dd>{claim.reason}</dd>
          </>
        )}
      </dl>

      {pending && claim.currentManagers > 0 && (
        <p className="warning">
          Este posto já tem {claim.currentManagers}{' '}
          {claim.currentManagers === 1
            ? 'pessoa com acesso'
            : 'pessoas com acesso'}
          . Confirme com o posto antes de liberar mais alguém.
        </p>
      )}

      {pending && mode === 'idle' && (
        <div className="row">
          <button
            type="button"
            className="button secondary grow"
            onClick={() => setMode('reject')}
          >
            Recusar
          </button>
          <button
            type="button"
            className="button grow"
            onClick={() => setMode('approve')}
          >
            Aprovar
          </button>
        </div>
      )}

      {pending && mode === 'approve' && (
        <div className="stack">
          <span className="muted">Como o vínculo foi confirmado?</span>
          <div
            className="segmented"
            role="radiogroup"
            aria-label="Forma de verificação"
          >
            {MANUAL_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
              >
                {VERIFICATION_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
          <div className="row">
            <button
              type="button"
              className="button secondary grow"
              onClick={() => setMode('idle')}
            >
              Voltar
            </button>
            <button
              type="button"
              className="button grow"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({
                  claimId: claim.id,
                  action: 'approve',
                  verificationMethod: method,
                })
              }
            >
              Confirmar aprovação
            </button>
          </div>
        </div>
      )}

      {pending && mode === 'reject' && (
        <div className="stack">
          <div className="field">
            <label htmlFor={`reason-${claim.id}`}>
              Motivo (a pessoa vê este texto)
            </label>
            <textarea
              id={`reason-${claim.id}`}
              className="input textarea"
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="row">
            <button
              type="button"
              className="button secondary grow"
              onClick={() => setMode('idle')}
            >
              Voltar
            </button>
            <button
              type="button"
              className="button danger grow"
              disabled={reason.trim().length < 5 || decide.isPending}
              onClick={() =>
                decide.mutate({
                  claimId: claim.id,
                  action: 'reject',
                  reason: reason.trim(),
                })
              }
            >
              Confirmar recusa
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </article>
  );
}
