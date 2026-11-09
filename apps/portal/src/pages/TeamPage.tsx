import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
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
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { useTeam, useTeamActions } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { usePortalContext } from './station-context';
import { PageLoading } from '../components/PageLoading';

type Actions = ReturnType<typeof useTeamActions>;
type Unit = { id: string; name: string };
type Access = { role: OrgRole; scope: OrgScope; stationIds: string[] };

const STATUS: Record<
  InvitationStatus,
  { label: string; color: 'default' | 'success' | 'warning' | 'error' }
> = {
  pendente: { label: 'Pendente', color: 'warning' },
  aceito: { label: 'Aceito', color: 'success' },
  recusado: { label: 'Recusado', color: 'default' },
  revogado: { label: 'Revogado', color: 'default' },
  expirado: { label: 'Expirado', color: 'default' },
};

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir.';
}

function scopeText(
  scope: OrgScope,
  stationIds: string[],
  names: Map<string, string>,
): string {
  return scope === 'todas'
    ? 'Todas as unidades'
    : stationIds.map((id) => names.get(id) ?? 'Unidade').join(', ');
}

/** Equipe da rede (ADR 0021): só proprietários. */
export function TeamPage() {
  const { org } = usePortalContext();
  const team = useTeam(org.id);
  const actions = useTeamActions(org.id);
  const { state, refreshUser } = useAuth();
  const myId = state.status === 'signedIn' ? state.user.id : '';
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (team.isPending) {
    return <PageLoading />;
  }
  if (team.isError) return <Alert severity="error">{team.error.message}</Alert>;
  const { members, invitations, stations } = team.data;
  const names = new Map(stations.map((s) => [s.id, s.name]));

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Equipe
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Quem cuida das unidades de {org.name}. Tudo o que muda aqui fica
            registrado.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddAlt1Outlined />}
          onClick={() => setInviting(true)}
          sx={{ flexShrink: 0 }}
        >
          Convidar pessoa
        </Button>
      </Stack>

      <Paper variant="outlined">
        <List disablePadding aria-label="Pessoas da equipe">
          {members.map((m, index) => (
            <ListItem
              key={m.userId}
              divider={index < members.length - 1}
              sx={{ gap: 1.5, alignItems: 'flex-start', py: 1.5 }}
            >
              <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                {(m.name ?? m.email ?? '?').trim().charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>
                  {m.name ?? 'Sem nome'}
                  {m.userId === myId && ' (você)'}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {m.email}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ mt: 0.75, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Chip
                    size="small"
                    color={m.role === 'proprietario' ? 'primary' : 'default'}
                    label={ORG_ROLE_LABELS[m.role]}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {scopeText(m.scope, m.stationIds, names)}
                  </Typography>
                </Stack>
              </Box>
              <Stack direction="row" sx={{ flexShrink: 0 }}>
                <Tooltip title="Alterar acesso">
                  <IconButton
                    aria-label={`Alterar acesso de ${m.name ?? m.email}`}
                    onClick={() => setEditing(m)}
                  >
                    <EditOutlined />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remover da equipe">
                  <IconButton
                    aria-label={`Remover ${m.name ?? m.email} da equipe`}
                    onClick={() => setRemoving(m)}
                  >
                    <DeleteOutline />
                  </IconButton>
                </Tooltip>
              </Stack>
            </ListItem>
          ))}
        </List>
      </Paper>

      {invitations.length > 0 && (
        <Paper variant="outlined">
          <Typography sx={{ fontWeight: 700, px: 2, pt: 2 }}>
            Convites
          </Typography>
          <List aria-label="Convites">
            {invitations.map((i, index) => (
              <InvitationRow
                key={i.id}
                invitation={i}
                names={names}
                divider={index < invitations.length - 1}
                busy={actions.revoke.isPending}
                onRevoke={() =>
                  actions.revoke.mutate(i.id, {
                    onSuccess: () =>
                      setNotice(`Convite para ${i.email} revogado.`),
                  })
                }
              />
            ))}
          </List>
          {errorText(actions.revoke.error) && (
            <Alert severity="error" sx={{ m: 2, mt: 0 }}>
              {errorText(actions.revoke.error)}
            </Alert>
          )}
        </Paper>
      )}

      {inviting && (
        <InviteDialog
          stations={stations}
          actions={actions}
          onClose={() => setInviting(false)}
          onDone={(email) => {
            setInviting(false);
            setNotice(
              `Convite criado para ${email}. Avise a pessoa para entrar em ${window.location.origin} com essa conta Google.`,
            );
          }}
        />
      )}

      {editing && (
        <AccessDialog
          title={`Acesso de ${editing.name ?? editing.email ?? 'pessoa'}`}
          initial={editing}
          stations={stations}
          submitLabel="Salvar"
          pending={actions.update.isPending}
          error={errorText(actions.update.error)}
          onClose={() => {
            actions.update.reset();
            setEditing(null);
          }}
          onSubmit={(value) =>
            actions.update.mutate(
              { userId: editing.userId, ...value },
              {
                onSuccess: () => {
                  if (editing.userId === myId) void refreshUser();
                  setEditing(null);
                  setNotice('Acesso atualizado.');
                },
              },
            )
          }
        />
      )}

      <Dialog
        open={removing !== null}
        onClose={() => {
          actions.remove.reset();
          setRemoving(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remover da equipe?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {removing?.name ?? removing?.email} perde o acesso às unidades de{' '}
            {org.name} no portal. Para voltar, precisa de um novo convite.
          </DialogContentText>
          {errorText(actions.remove.error) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(actions.remove.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              actions.remove.reset();
              setRemoving(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={actions.remove.isPending}
            onClick={() =>
              removing &&
              actions.remove.mutate(removing.userId, {
                onSuccess: () => {
                  if (removing.userId === myId) void refreshUser();
                  setNotice(
                    `${removing.name ?? removing.email} saiu da equipe.`,
                  );
                  setRemoving(null);
                },
              })
            }
          >
            Remover
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notice !== null}
        autoHideDuration={6000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setNotice(null)}
          sx={{ width: '100%' }}
        >
          {notice}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function InvitationRow({
  invitation,
  names,
  divider,
  busy,
  onRevoke,
}: {
  invitation: Invitation;
  names: Map<string, string>;
  divider: boolean;
  busy: boolean;
  onRevoke: () => void;
}) {
  const status = STATUS[invitation.status];
  const pending = invitation.status === 'pendente';
  return (
    <ListItem divider={divider} sx={{ gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 600 }}>
          {invitation.email}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {ORG_ROLE_LABELS[invitation.role]} ·{' '}
          {scopeText(invitation.scope, invitation.stationIds, names)}
          {pending &&
            ` · vale até ${new Date(invitation.expiresAt).toLocaleDateString('pt-BR')}`}
        </Typography>
      </Box>
      <Stack spacing={0.5} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <Chip
          size="small"
          variant="outlined"
          color={status.color}
          label={status.label}
        />
        {pending && (
          <Button size="small" color="error" disabled={busy} onClick={onRevoke}>
            Revogar
          </Button>
        )}
      </Stack>
    </ListItem>
  );
}

/** Papel (com a descrição) e unidades. Usado no convite e na alteração. */
function AccessFields({
  value,
  onChange,
  stations,
}: {
  value: Access;
  onChange: (value: Access) => void;
  stations: Unit[];
}) {
  const scope = value.role === 'proprietario' ? 'todas' : value.scope;
  return (
    <Stack spacing={2}>
      <FormControl>
        <FormLabel id="role-label">Papel</FormLabel>
        <RadioGroup
          aria-labelledby="role-label"
          value={value.role}
          onChange={(event) =>
            onChange({ ...value, role: event.target.value as OrgRole })
          }
        >
          {ORG_ROLES.map((r) => (
            <FormControlLabel
              key={r}
              value={r}
              control={<Radio />}
              sx={{ alignItems: 'flex-start', mt: 0.5 }}
              label={
                <Box sx={{ pt: 1 }}>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                    {ORG_ROLE_LABELS[r]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {ORG_ROLE_DESCRIPTIONS[r]}
                  </Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>
      </FormControl>

      {value.role !== 'proprietario' && stations.length > 1 && (
        <FormControl>
          <FormLabel id="scope-label">Unidades</FormLabel>
          <RadioGroup
            aria-labelledby="scope-label"
            value={scope}
            onChange={(event) =>
              onChange({ ...value, scope: event.target.value as OrgScope })
            }
          >
            <FormControlLabel
              value="todas"
              control={<Radio />}
              label="Todas (inclui as que entrarem na rede depois)"
            />
            <FormControlLabel
              value="selecionadas"
              control={<Radio />}
              label="Só as escolhidas"
            />
          </RadioGroup>
          {scope === 'selecionadas' && (
            <FormGroup sx={{ pl: 4 }}>
              {stations.map((s) => (
                <FormControlLabel
                  key={s.id}
                  label={s.name}
                  control={
                    <Checkbox
                      checked={value.stationIds.includes(s.id)}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          stationIds: event.target.checked
                            ? [...value.stationIds, s.id]
                            : value.stationIds.filter((id) => id !== s.id),
                        })
                      }
                    />
                  }
                />
              ))}
            </FormGroup>
          )}
        </FormControl>
      )}
    </Stack>
  );
}

function normalized(value: Access): Access {
  const scope = value.role === 'proprietario' ? 'todas' : value.scope;
  return {
    role: value.role,
    scope,
    stationIds: scope === 'todas' ? [] : value.stationIds,
  };
}

function ResponsiveDialog({
  open,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={mobile}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { component: 'form', onSubmit } }}
    >
      {children}
    </Dialog>
  );
}

function AccessDialog({
  title,
  initial,
  stations,
  submitLabel,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: Access;
  stations: Unit[];
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (value: Access) => void;
}) {
  const [value, setValue] = useState<Access>(initial);
  const final = normalized(value);
  const valid = final.scope === 'todas' || final.stationIds.length > 0;

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSubmit(final);
      }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <AccessFields value={value} onChange={setValue} stations={stations} />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!valid || pending}>
          {pending ? 'Salvando…' : submitLabel}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}

function InviteDialog({
  stations,
  actions,
  onClose,
  onDone,
}: {
  stations: Unit[];
  actions: Actions;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [value, setValue] = useState<Access>({
    role: 'operador',
    scope: 'todas',
    stationIds: [],
  });
  const final = normalized(value);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid =
    emailOk && (final.scope === 'todas' || final.stationIds.length > 0);
  const error = errorText(actions.invite.error);

  function close() {
    actions.invite.reset();
    onClose();
  }

  return (
    <ResponsiveDialog
      open
      onClose={close}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        actions.invite.mutate(
          { email: email.trim(), ...final },
          { onSuccess: (invitation) => onDone(invitation.email) },
        );
      }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Convidar pessoa</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="E-mail da conta Google"
            type="email"
            placeholder="nome@empresa.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
            fullWidth
            helperText="A pessoa entra no portal com essa conta e aceita o convite. Ainda não enviamos e-mail: avise-a."
            slotProps={{ htmlInput: { autoComplete: 'off' } }}
          />
          <AccessFields value={value} onChange={setValue} stations={stations} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close}>Cancelar</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!valid || actions.invite.isPending}
        >
          {actions.invite.isPending ? 'Criando…' : 'Criar convite'}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
