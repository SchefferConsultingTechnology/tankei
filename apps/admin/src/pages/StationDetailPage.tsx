import HubOutlined from '@mui/icons-material/HubOutlined';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import MenuItem from '@mui/material/MenuItem';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { VERIFICATION_METHOD_LABELS, type AdminStation } from '@tankei/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  useAddManager,
  useNetworks,
  useSetStationNetwork,
  useStation,
} from '../api/admin-queries';
import { errorText, formatDateTime, useMobile } from '../components/hooks';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';
import { StationModeSection } from '../components/StationModeSection';

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

/** Posto: rede, responsáveis verificados e vínculo direto (ADR 0011). */
export function StationDetailPage() {
  const { stationId = '' } = useParams();
  const station = useStation(stationId);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<'mover' | 'tirar' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (station.isPending) return <PageLoading />;
  if (station.isError) {
    return <Alert severity="error">{station.error.message}</Alert>;
  }
  const s = station.data;

  return (
    <Stack spacing={2}>
      <PageHeader
        back={{ to: '/postos', label: 'Postos' }}
        title={s.name}
        subtitle={
          <>
            {s.legalName} · CNPJ {s.cnpj}
            <br />
            {s.brand} · {s.address}
            {s.district ? `, ${s.district}` : ''} · {s.city}/{s.state}
          </>
        }
      />
      {!s.active && (
        <Alert severity="warning">
          Posto inativo no cadastro da ANP: não aparece no app.
        </Alert>
      )}
      {s.pendingClaims > 0 && (
        <Alert
          severity="info"
          action={
            <Button component={Link} to="/" color="inherit" size="small">
              Ver pedidos
            </Button>
          }
        >
          {s.pendingClaims === 1
            ? '1 pedido de acesso em análise para este posto.'
            : `${s.pendingClaims} pedidos de acesso em análise para este posto.`}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Section title="Rede">
          {s.network ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <HubOutlined color="action" />
                <Typography sx={{ fontWeight: 600 }}>
                  {s.network.name}
                </Typography>
              </Stack>
              <Button component={Link} to={`/redes/${s.network.id}`}>
                Abrir rede
              </Button>
            </Stack>
          ) : null}
          {s.network ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button size="small" onClick={() => setMoving('mover')}>
                Mover para outra rede
              </Button>
              <Button size="small" color="error" onClick={() => setMoving('tirar')}>
                Tirar da rede
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ainda sem rede. Ao vincular um responsável, o posto entra na rede
              dele (ou numa rede nova).
            </Typography>
          )}
        </Section>

        <Section
          title="Responsáveis verificados"
          action={
            <Button
              startIcon={<PersonAddAlt1Outlined />}
              onClick={() => setAdding(true)}
            >
              Vincular
            </Button>
          }
        >
          {s.verifiedManagers.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Ninguém com vínculo comprovado.
            </Typography>
          ) : (
            <List dense disablePadding>
              {s.verifiedManagers.map((m) => (
                <ListItem key={m.userId} disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <VerifiedUserOutlined color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={m.name ?? m.email ?? 'Conta sem nome'}
                    secondary={[
                      m.name && m.email,
                      m.verificationMethod &&
                        VERIFICATION_METHOD_LABELS[m.verificationMethod],
                      m.verifiedAt && formatDateTime(m.verifiedAt),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    slotProps={{
                      secondary: { sx: { overflowWrap: 'anywhere' } },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          {s.network && s.verifiedManagers.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              Para retirar alguém, abra a rede e remova da equipe.
            </Typography>
          )}
        </Section>
      </Box>

      {moving && (
        <NetworkDialog
          station={s}
          mode={moving}
          onClose={() => setMoving(null)}
          onDone={(message) => {
            setMoving(null);
            setNotice(message);
          }}
        />
      )}
      <StationModeSection station={s} onNotice={setNotice} />

      {adding && (
        <AddManagerDialog
          station={s}
          onClose={() => setAdding(false)}
          onDone={(email) => {
            setAdding(false);
            setNotice(`${email} agora é responsável por ${s.name}.`);
          }}
        />
      )}
      <Notice message={notice} onClose={() => setNotice(null)} />
    </Stack>
  );
}

function AddManagerDialog({
  station,
  onClose,
  onDone,
}: {
  station: AdminStation;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const add = useAddManager(station.id);
  const [email, setEmail] = useState('');
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const value = email.trim().toLowerCase();
    add.mutate(value, { onSuccess: () => onDone(value) });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={useMobile()}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { component: 'form', onSubmit: submit } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Vincular responsável</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Use quando o vínculo com <strong>{station.name}</strong> foi
          comprovado pessoalmente. Fica registrado como verificação{' '}
          <Chip size="small" label="Presencial" component="span" />, e a pessoa
          vira proprietária da rede do posto.
        </DialogContentText>
        <TextField
          label="E-mail da conta"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          helperText="A pessoa precisa ter entrado no portal ou no app uma vez."
          autoFocus
          fullWidth
        />
        {errorText(add.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(add.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!valid || add.isPending}
        >
          Vincular
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function NetworkDialog({
  station,
  mode,
  onClose,
  onDone,
}: {
  station: AdminStation;
  mode: 'mover' | 'tirar';
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const setNetwork = useSetStationNetwork(station.id);
  const networks = useNetworks('');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const options = (networks.data ?? []).filter(
    (n) => n.id !== station.network?.id,
  );
  const valid =
    reason.trim().length >= 5 &&
    (mode === 'tirar' || target !== '') &&
    !setNetwork.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const name = options.find((n) => n.id === target)?.name;
    setNetwork.mutate(
      { networkId: mode === 'tirar' ? null : target, reason: reason.trim() },
      {
        onSuccess: () =>
          onDone(
            mode === 'tirar'
              ? `${station.name} saiu da rede.`
              : `${station.name} agora é da rede ${name ?? ''}.`,
          ),
      },
    );
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
      <DialogTitle sx={{ fontWeight: 700 }}>
        {mode === 'tirar' ? 'Tirar da rede' : 'Mover para outra rede'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {mode === 'tirar'
            ? `${station.name} sai de ${station.network?.name}. A equipe dessa rede perde o acesso ao posto.`
            : `${station.name} sai de ${station.network?.name} e passa para a rede escolhida. A equipe atual perde o acesso; a da nova rede ganha, conforme o escopo de cada um.`}
        </DialogContentText>
        <Stack spacing={2}>
          {mode === 'mover' && (
            <TextField
              select
              label="Nova rede"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              fullWidth
              helperText={
                networks.isPending ? 'Carregando redes…' : undefined
              }
            >
              {options.map((n) => (
                <MenuItem key={n.id} value={n.id}>
                  {n.name} ({n.stations}{' '}
                  {n.stations === 1 ? 'unidade' : 'unidades'})
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Motivo"
            helperText="Fica no registro das redes, com seu nome."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
          {errorText(setNetwork.error) && (
            <Alert severity="error">{errorText(setNetwork.error)}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          variant="contained"
          color={mode === 'tirar' ? 'error' : 'primary'}
          disabled={!valid}
        >
          {mode === 'tirar' ? 'Tirar da rede' : 'Mover'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
