import { ORG_ROLE_DESCRIPTIONS, ORG_ROLE_LABELS } from '@tankei/shared';
import { ApiError } from '../api/client';
import { useAnswerInvitation, useMyInvitations } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';

/** Convites pendentes para o e-mail da conta, para aceitar ou recusar. */
export function InvitationsBanner() {
  const invitations = useMyInvitations();
  const answer = useAnswerInvitation();
  const { refreshUser } = useAuth();

  if (!invitations.data || invitations.data.length === 0) return null;

  return (
    <section className="stack">
      {invitations.data.map((inv) => (
        <article key={inv.id} className="card stack invitation">
          <div>
            <strong>Convite para a equipe de {inv.organization.name}</strong>
            <div className="muted">
              {inv.invitedBy
                ? `${inv.invitedBy} convidou você`
                : 'Você foi convidado'}{' '}
              como <strong>{ORG_ROLE_LABELS[inv.role]}</strong>:{' '}
              {ORG_ROLE_DESCRIPTIONS[inv.role].toLowerCase()}
            </div>
            <div className="muted">
              {inv.stations.length === 1 ? 'Unidade' : 'Unidades'}:{' '}
              {inv.stations.map((s) => s.name).join(', ')}
            </div>
          </div>
          <div className="row">
            <button
              type="button"
              className="button secondary grow"
              disabled={answer.isPending}
              onClick={() => answer.mutate({ id: inv.id, accept: false })}
            >
              Recusar
            </button>
            <button
              type="button"
              className="button grow"
              disabled={answer.isPending}
              onClick={() =>
                answer.mutate(
                  { id: inv.id, accept: true },
                  { onSuccess: () => void refreshUser() },
                )
              }
            >
              Aceitar
            </button>
          </div>
        </article>
      ))}
      {answer.error && (
        <p className="error">
          {answer.error instanceof ApiError
            ? answer.error.message
            : 'Não foi possível responder ao convite.'}
        </p>
      )}
    </section>
  );
}
