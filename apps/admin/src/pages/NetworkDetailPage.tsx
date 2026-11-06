import EditOutlined from '@mui/icons-material/EditOutlined';
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  ORG_ROLE_DESCRIPTIONS,
  ORG_ROLE_LABELS,
  ORG_ROLES,
  type AdminNetwork,
  type AdminNetworkMember,
  type InvitationStatus,
  type OrgRole,
  type OrgScope,
} from '@tankei/shared';
import { Fragment, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  useNetwork,
  useRemoveMember,
  useRenameNetwork,
  useUpdateMember,
} from '../api/admin-queries';
import { errorText, formatDateTime, useMobile } from '../components/hooks';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';

type TabKey = 'unidades' | 'equipe' | 'convites' | 'registro';
type Access = { role: OrgRole; scope: OrgScope; stationIds: string[] };
type Unit = AdminNetwork['stations'][number];

const INVITATION_STATUS: Record<
  InvitationStatus,
  { label: string; color: 'warning' | 'success' | 'default' | 'error' }
> = {
  pendente: { label: 'Pendente', color: 'warning' },
  aceito: { label: 'Aceito', color: 'success' },
  recusado: { label: 'Recusado', color: 'error' },
  revogado: { label: 'Revogado', color: 'default' },
  expirado: { label: 'Expirado', color: 'default' },
};

function personName(m: { name: string | null; email: string | null }) {
  return m.name ?? m.email ?? 'Conta sem nome';
}

function scopeText(scope: OrgScope, ids: string[], units: Unit[]) {
  if (scope === 'todas') return 'Todas as unidades';
  return ids
    .map((id) => units.find((u) => u.id === id)?.name ?? 'Unidade')
    .join(', ');
}

/** Rede (ADR 0021): unidades, equipe, convites e registro. */
export function NetworkDetailPage() {
  const { networkId = '' } = useParams();
  const network = useNetwork(networkId);
  const [tab, setTab] = useState<TabKey>('equipe');
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState<AdminNetworkMember | null>(null);
  const [removing, setRemoving] = useState<AdminNetworkMember | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (network.isPending) return <PageLoading />;
  if (network.isError) {
    return <Alert severity="error">{network.error.message}</Alert>;
  }
  const n = network.data;
  const owners = n.members.filter((m) => m.role === 'proprietario');
  const pending = n.invitations.filter((i) => i.status === 'pendente').length;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'equipe', label: `Equipe (${n.members.length})` },
    { key: 'unidades', label: `Unidades (${n.stations.length})` },
    {
      key: 'convites',
      label: pending > 0 ? `Convites (${pending} pendente)` : 'Convites',
    },
    { key: 'registro', label: 'Registro' },
  ];

  return (
    <Stack spacing={2}>
      <PageHeader
        back={{ to: '/redes', label: 'Redes' }}
        title={n.name}
        subtitle={`Criada em ${formatDateTime(n.createdAt)}`}
        actions={
          <Tooltip title="Renomear">
            <IconButton aria-label="Renomear" onClick={() => setRenaming(true)}>
              <EditOutlined />
            </IconButton>
          </Tooltip>
        }
      />

      {owners.length === 0 && (
        <Alert severity="warning">
          Esta rede está sem proprietário: ninguém gerencia a equipe. Promova
          alguém da equipe ou vincule um responsável pelo posto.
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, value: TabKey) => setTab(value)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Seções da rede"
      >
        {tabs.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      {tab === 'equipe' && (
        <ListCard empty="Ninguém na equipe.">
          {n.members.map((m) => (
            <ListItem
              key={m.userId}
              sx={{ gap: 1.5, flexWrap: 'wrap', py: 1.25 }}
            >
              <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{personName(m)}</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {m.name && m.email ? `${m.email} · ` : ''}
                  {scopeText(m.scope, m.stationIds, n.stations)} · desde{' '}
                  {new Date(m.since).toLocaleDateString('pt-BR')}
                </Typography>
              </Box>
              <Chip
                size="small"
                variant="outlined"
                color={m.role === 'proprietario' ? 'primary' : 'default'}
                label={ORG_ROLE_LABELS[m.role]}
              />
              <Stack direction="row">
                <Tooltip title="Alterar papel">
                  <IconButton
                    aria-label={`Alterar papel de ${personName(m)}`}
                    onClick={() => setEditing(m)}
                  >
                    <EditOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remover da equipe">
                  <IconButton
                    aria-label={`Remover ${personName(m)}`}
                    onClick={() => setRemoving(m)}
                  >
                    <PersonRemoveOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </ListItem>
          ))}
        </ListCard>
      )}

      {tab === 'unidades' && (
        <ListCard empty="Nenhuma unidade.">
          {n.stations.map((s) => (
            <ListItem key={s.id} disablePadding>
              <ListItemButton component={Link} to={`/postos/${s.id}`}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    CNPJ {s.cnpj} · {s.city}/{s.state}
                  </Typography>
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </ListCard>
      )}

      {tab === 'convites' && (
        <ListCard empty="Nenhum convite nos últimos 90 dias.">
          {n.invitations.map((i) => (
            <ListItem key={i.id} sx={{ gap: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                <Typography
                  sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                >
                  {i.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {ORG_ROLE_LABELS[i.role]} ·{' '}
                  {scopeText(i.scope, i.stationIds, n.stations)}
                  {i.invitedBy ? ` · por ${i.invitedBy}` : ''} ·{' '}
                  {formatDateTime(i.createdAt)}
                </Typography>
              </Box>
              <Chip
                size="small"
                variant="outlined"
                color={INVITATION_STATUS[i.status].color}
                label={INVITATION_STATUS[i.status].label}
              />
            </ListItem>
          ))}
        </ListCard>
      )}

      {tab === 'registro' && (
        <ListCard empty="Nada registrado.">
          {n.events.map((e) => (
            <ListItem key={e.id} sx={{ display: 'block' }}>
              <Typography variant="body2">{e.description}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(e.createdAt)} · {e.actor ?? 'Sistema'}
              </Typography>
            </ListItem>
          ))}
        </ListCard>
      )}

      {renaming && (
        <RenameDialog
          network={n}
          onClose={() => setRenaming(false)}
          onDone={() => {
            setRenaming(false);
            setNotice('Rede renomeada.');
          }}
        />
      )}
      {editing && (
        <MemberDialog
          network={n}
          member={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setNotice(`Acesso de ${personName(editing)} alterado.`);
            setEditing(null);
          }}
        />
      )}
      {removing && (
        <RemoveDialog
          network={n}
          member={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setNotice(`${personName(removing)} saiu da equipe.`);
            setRemoving(null);
          }}
        />
      )}
      <Notice message={notice} onClose={() => setNotice(null)} />
    </Stack>
  );
}

function ListCard({
  empty,
  children,
}: {
  empty: string;
  children: ReactNode[];
}) {
  if (children.length === 0) {
    return <Alert severity="info">{empty}</Alert>;
  }
  return (
    <Paper variant="outlined">
      <List disablePadding>
        {children.map((child, index) => (
          <Fragment key={index}>
            {index > 0 && <Divider component="li" />}
            {child}
          </Fragment>
        ))}
      </List>
    </Paper>
  );
}

function ReasonField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      label="Motivo"
      placeholder="Ex.: proprietário pediu por telefone"
      helperText="Fica no registro da rede, com seu nome."
      value={value}
      onChange={(event) => onChange(event.target.value)}
      multiline
      minRows={2}
      fullWidth
      slotProps={{ htmlInput: { maxLength: 300 } }}
    />
  );
}

function FormDialog({
  title,
  intro,
  children,
  error,
  submitLabel,
  submitColor = 'primary',
  canSubmit,
  onSubmit,
  onClose,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  error: unknown;
  submitLabel: string;
  submitColor?: 'primary' | 'error';
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }
  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={useMobile()}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { component: 'form', onSubmit: submit } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        {intro && <DialogContentText sx={{ mb: 2 }}>{intro}</DialogContentText>}
        <Stack spacing={2} sx={{ pt: intro ? 0 : 1 }}>
          {children}
          {errorText(error) && (
            <Alert severity="error">{errorText(error)}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          variant="contained"
          color={submitColor}
          disabled={!canSubmit}
        >
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RenameDialog({
  network,
  onClose,
  onDone,
}: {
  network: AdminNetwork;
  onClose: () => void;
  onDone: () => void;
}) {
  const rename = useRenameNetwork(network.id);
  const [name, setName] = useState(network.name);
  const valid = name.trim().length >= 2 && name.trim() !== network.name;
  return (
    <FormDialog
      title="Renomear rede"
      error={rename.error}
      submitLabel="Salvar"
      canSubmit={valid && !rename.isPending}
      onSubmit={() => rename.mutate(name.trim(), { onSuccess: onDone })}
      onClose={onClose}
    >
      <TextField
        label="Nome da rede"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoFocus
        fullWidth
        slotProps={{ htmlInput: { maxLength: 80 } }}
      />
    </FormDialog>
  );
}

function MemberDialog({
  network,
  member,
  onClose,
  onDone,
}: {
  network: AdminNetwork;
  member: AdminNetworkMember;
  onClose: () => void;
  onDone: () => void;
}) {
  const update = useUpdateMember(network.id);
  const [access, setAccess] = useState<Access>({
    role: member.role,
    scope: member.scope,
    stationIds: member.stationIds,
  });
  const [reason, setReason] = useState('');
  const scope = access.role === 'proprietario' ? 'todas' : access.scope;
  const stationIds = scope === 'todas' ? [] : access.stationIds;
  const valid =
    (scope === 'todas' || stationIds.length > 0) && reason.trim().length >= 5;

  return (
    <FormDialog
      title={`Acesso de ${personName(member)}`}
      intro="Use para suporte, por exemplo quando a rede ficou sem proprietário. O proprietário também pode fazer isso no portal."
      error={update.error}
      submitLabel="Salvar"
      canSubmit={valid && !update.isPending}
      onSubmit={() =>
        update.mutate(
          {
            userId: member.userId,
            role: access.role,
            scope,
            stationIds,
            reason: reason.trim(),
          },
          { onSuccess: onDone },
        )
      }
      onClose={onClose}
    >
      <FormControl>
        <FormLabel id="role-label">Papel</FormLabel>
        <RadioGroup
          aria-labelledby="role-label"
          value={access.role}
          onChange={(event) =>
            setAccess({ ...access, role: event.target.value as OrgRole })
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

      {access.role !== 'proprietario' && network.stations.length > 1 && (
        <FormControl>
          <FormLabel id="scope-label">Unidades</FormLabel>
          <RadioGroup
            aria-labelledby="scope-label"
            value={scope}
            onChange={(event) =>
              setAccess({ ...access, scope: event.target.value as OrgScope })
            }
          >
            <FormControlLabel value="todas" control={<Radio />} label="Todas" />
            <FormControlLabel
              value="selecionadas"
              control={<Radio />}
              label="Só as escolhidas"
            />
          </RadioGroup>
          {scope === 'selecionadas' && (
            <FormGroup sx={{ pl: 4 }}>
              {network.stations.map((s) => (
                <FormControlLabel
                  key={s.id}
                  label={s.name}
                  control={
                    <Checkbox
                      checked={access.stationIds.includes(s.id)}
                      onChange={(event) =>
                        setAccess({
                          ...access,
                          stationIds: event.target.checked
                            ? [...access.stationIds, s.id]
                            : access.stationIds.filter((id) => id !== s.id),
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

      <ReasonField value={reason} onChange={setReason} />
    </FormDialog>
  );
}

function RemoveDialog({
  network,
  member,
  onClose,
  onDone,
}: {
  network: AdminNetwork;
  member: AdminNetworkMember;
  onClose: () => void;
  onDone: () => void;
}) {
  const remove = useRemoveMember(network.id);
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      title="Remover da equipe"
      intro={
        <>
          <strong>{personName(member)}</strong> perde o acesso a {network.name}{' '}
          no portal e a verificação de responsável nas unidades da rede. Use,
          por exemplo, para um acesso indevido ou alguém que saiu do posto.
        </>
      }
      error={remove.error}
      submitLabel="Remover"
      submitColor="error"
      canSubmit={reason.trim().length >= 5 && !remove.isPending}
      onSubmit={() =>
        remove.mutate(
          { userId: member.userId, reason: reason.trim() },
          { onSuccess: onDone },
        )
      }
      onClose={onClose}
    >
      <ReasonField value={reason} onChange={setReason} />
    </FormDialog>
  );
}
