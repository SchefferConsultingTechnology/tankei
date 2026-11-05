import {
  ORG_ROLE_DESCRIPTIONS,
  ORG_ROLE_LABELS,
  ORG_ROLES,
  type Invitation,
  type InvitationStatus,
  type OrgRole,
  type OrgScope,
  type TeamMember,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useTeam, useTeamActions } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { usePortalContext } from './station-context';

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pendente: 'Pendente',
  aceito: 'Aceito',
  recusado: 'Recusado',
  revogado: 'Revogado',
  expirado: 'Expirado',
};

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir.';
}

/** Equipe da rede (ADR 0021): só proprietários. */
export function TeamPage() {
  const { org } = usePortalContext();
  const team = useTeam(org.id);
  const actions = useTeamActions(org.id);
  const { state, refreshUser } = useAuth();
  const myId = state.status === 'signedIn' ? state.user.id : '';

  if (team.isPending) return <p className="muted">Carregando…</p>;
  if (team.isError) return <p className="error">{team.error.message}</p>;
  const { members, invitations, stations } = team.data;
  const stationName = new Map(stations.map((s) => [s.id, s.name]));

  return (
    <div className="stack">
      <h1 className="page-title">Equipe</h1>
      <p className="muted" style={{ margin: 0 }}>
        Quem cuida das unidades de {org.name}, com o papel e as unidades de cada
        pessoa. Tudo o que muda aqui fica registrado.
      </p>

      <section className="card stack">
        <strong>Pessoas</strong>
        <ul className="list">
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              stations={stations}
              stationName={stationName}
              isMe={m.userId === myId}
              actions={actions}
              onChanged={() => void refreshUser()}
            />
          ))}
        </ul>
      </section>

      <InviteForm stations={stations} actions={actions} />

      {invitations.length > 0 && (
        <section className="card stack">
          <strong>Convites</strong>
          <ul className="list">
            {invitations.map((i) => (
              <InvitationRow
                key={i.id}
                invitation={i}
                stationName={stationName}
                onRevoke={() => actions.revoke.mutate(i.id)}
                busy={actions.revoke.isPending}
              />
            ))}
          </ul>
          {errorText(actions.revoke.error) && (
            <p className="error">{errorText(actions.revoke.error)}</p>
          )}
        </section>
      )}
    </div>
  );
}

type Actions = ReturnType<typeof useTeamActions>;
type Unit = { id: string; name: string };

function scopeText(
  scope: OrgScope,
  stationIds: string[],
  stationName: Map<string, string>,
) {
  return scope === 'todas'
    ? 'Todas as unidades'
    : stationIds.map((id) => stationName.get(id) ?? 'Unidade').join(', ');
}

function MemberRow({
  member,
  stations,
  stationName,
  isMe,
  actions,
  onChanged,
}: {
  member: TeamMember;
  stations: Unit[];
  stationName: Map<string, string>;
  isMe: boolean;
  actions: Actions;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="grow">
          <strong>
            {member.name ?? 'Sem nome'}
            {isMe && ' (você)'}
          </strong>
          <div className="muted truncate">{member.email}</div>
        </div>
        <span className="tag">{ORG_ROLE_LABELS[member.role]}</span>
      </div>
      <div className="muted">
        {scopeText(member.scope, member.stationIds, stationName)}
      </div>
      {editing ? (
        <AccessEditor
          initial={member}
          stations={stations}
          submitLabel="Salvar"
          pending={actions.update.isPending}
          error={errorText(actions.update.error)}
          onCancel={() => setEditing(false)}
          onSubmit={(value) =>
            actions.update.mutate(
              { userId: member.userId, ...value },
              {
                onSuccess: () => {
                  setEditing(false);
                  if (isMe) onChanged();
                },
              },
            )
          }
        />
      ) : (
        <div className="row">
          <button
            type="button"
            className="button ghost"
            onClick={() => setEditing(true)}
          >
            Alterar acesso
          </button>
          <button
            type="button"
            className="button ghost"
            style={{ color: 'var(--danger)' }}
            disabled={actions.remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Remover ${member.name ?? member.email ?? 'esta pessoa'} da equipe?`,
                )
              ) {
                actions.remove.mutate(member.userId, {
                  onSuccess: () => {
                    if (isMe) onChanged();
                  },
                });
              }
            }}
          >
            Remover
          </button>
        </div>
      )}
      {!editing && errorText(actions.remove.error) && (
        <p className="error">{errorText(actions.remove.error)}</p>
      )}
    </li>
  );
}

/** Papel e escopo (usado no convite e na alteração). */
function AccessEditor({
  initial,
  stations,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
  children,
}: {
  initial: { role: OrgRole; scope: OrgScope; stationIds: string[] };
  stations: Unit[];
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (value: {
    role: OrgRole;
    scope: OrgScope;
    stationIds: string[];
  }) => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}) {
  const [role, setRole] = useState<OrgRole>(initial.role);
  const [scope, setScope] = useState<OrgScope>(initial.scope);
  const [picked, setPicked] = useState<Set<string>>(
    new Set(initial.stationIds),
  );
  const effectiveScope: OrgScope = role === 'proprietario' ? 'todas' : scope;
  const valid = effectiveScope === 'todas' || picked.size > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSubmit({
      role,
      scope: effectiveScope,
      stationIds: effectiveScope === 'todas' ? [] : [...picked],
    });
  }

  return (
    <form className="stack" onSubmit={submit}>
      {children}
      <fieldset className="checklist">
        <legend className="muted">Papel</legend>
        {ORG_ROLES.map((r) => (
          <label
            key={r}
            className="row"
            style={{ gap: 8, alignItems: 'flex-start' }}
          >
            <input
              type="radio"
              name="role"
              checked={role === r}
              onChange={() => setRole(r)}
            />
            <span>
              <strong>{ORG_ROLE_LABELS[r]}</strong>
              <span className="muted"> · {ORG_ROLE_DESCRIPTIONS[r]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {role !== 'proprietario' && stations.length > 1 && (
        <fieldset className="checklist">
          <legend className="muted">Unidades</legend>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="radio"
              name="scope"
              checked={scope === 'todas'}
              onChange={() => setScope('todas')}
            />
            Todas (inclui as que entrarem na rede depois)
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="radio"
              name="scope"
              checked={scope === 'selecionadas'}
              onChange={() => setScope('selecionadas')}
            />
            Só as escolhidas
          </label>
          {scope === 'selecionadas' &&
            stations.map((s) => (
              <label key={s.id} className="row indent" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={picked.has(s.id)}
                  onChange={() => {
                    const next = new Set(picked);
                    if (next.has(s.id)) next.delete(s.id);
                    else next.add(s.id);
                    setPicked(next);
                  }}
                />
                {s.name}
              </label>
            ))}
        </fieldset>
      )}

      {error && <p className="error">{error}</p>}
      <div className="row">
        {onCancel && (
          <button
            type="button"
            className="button secondary grow"
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="button grow"
          disabled={!valid || pending}
        >
          {pending ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function InviteForm({
  stations,
  actions,
}: {
  stations: Unit[];
  actions: Actions;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <section className="card stack">
      <div>
        <strong>Convidar pessoa</strong>
        <div className="muted">
          A pessoa entra no portal com uma conta Google desse e-mail e aceita o
          convite. Ainda não enviamos e-mail: avise-a e mande o endereço do
          portal ({window.location.origin}).
        </div>
      </div>
      {sent && (
        <p role="status" style={{ color: 'var(--success)', margin: 0 }}>
          Convite criado para {sent}.
        </p>
      )}
      <AccessEditor
        key={formKey}
        initial={{ role: 'operador', scope: 'todas', stationIds: [] }}
        stations={stations}
        submitLabel="Criar convite"
        pending={actions.invite.isPending}
        error={errorText(actions.invite.error)}
        onSubmit={(value) => {
          if (!emailOk) return;
          actions.invite.mutate(
            { email: email.trim(), ...value },
            {
              onSuccess: (invitation) => {
                setSent(invitation.email);
                setEmail('');
                setFormKey((k) => k + 1);
              },
            },
          );
        }}
      >
        <div className="field">
          <label htmlFor="invite-email">E-mail (conta Google)</label>
          <input
            id="invite-email"
            className="input"
            type="email"
            autoComplete="off"
            placeholder="nome@empresa.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </AccessEditor>
    </section>
  );
}

function InvitationRow({
  invitation,
  stationName,
  onRevoke,
  busy,
}: {
  invitation: Invitation;
  stationName: Map<string, string>;
  onRevoke: () => void;
  busy: boolean;
}) {
  const pending = invitation.status === 'pendente';
  return (
    <li className="row" style={{ flexWrap: 'wrap' }}>
      <div className="grow">
        <strong className="truncate">{invitation.email}</strong>
        <div className="muted">
          {ORG_ROLE_LABELS[invitation.role]} ·{' '}
          {scopeText(invitation.scope, invitation.stationIds, stationName)}
          {pending &&
            ` · vale até ${new Date(invitation.expiresAt).toLocaleDateString('pt-BR')}`}
        </div>
      </div>
      <span className="status muted">{STATUS_LABEL[invitation.status]}</span>
      {pending && (
        <button
          type="button"
          className="button ghost"
          style={{ color: 'var(--danger)' }}
          disabled={busy}
          onClick={onRevoke}
        >
          Revogar
        </button>
      )}
    </li>
  );
}
