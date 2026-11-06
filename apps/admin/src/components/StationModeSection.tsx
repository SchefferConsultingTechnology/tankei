import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  HIDE_REASON_LABELS,
  HIDE_REASONS,
  modeNeedsHideReason,
  STATION_MODE_DESCRIPTIONS,
  STATION_MODE_LABELS,
  STATION_MODES,
  type AdminStation,
  type HideReason,
  type StationMode,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { useSetStationMode } from '../api/admin-queries';
import { errorText, formatDateTime, useMobile } from './hooks';

const MODE_COLOR: Record<
  StationMode,
  'default' | 'info' | 'primary' | 'warning' | 'error'
> = {
  normal: 'default',
  nao_participa: 'info',
  preco_oficial: 'primary',
  precos_ocultos: 'warning',
  oculto: 'error',
};

export function ModeChip({ mode }: { mode: StationMode }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={MODE_COLOR[mode]}
      label={STATION_MODE_LABELS[mode]}
    />
  );
}

/**
 * Como o posto aparece no app (ADR 0028): decisão da administração, a pedido
 * do posto, com registro de quem pediu e por quê.
 */
export function StationModeSection({
  station,
  onNotice,
}: {
  station: AdminStation;
  onNotice: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
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
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            Exibição no app
          </Typography>
          <ModeChip mode={station.mode} />
        </Stack>
        <Button onClick={() => setEditing(true)}>Alterar</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {STATION_MODE_DESCRIPTIONS[station.mode]}
      </Typography>

      {station.modeHistory.length > 0 && (
        <List dense disablePadding sx={{ mt: 1 }}>
          {station.modeHistory.map((h) => (
            <ListItem key={h.createdAt} disableGutters sx={{ display: 'block' }}>
              <Typography variant="body2">
                <strong>{STATION_MODE_LABELS[h.mode]}</strong>
                {h.hideReason ? ` (${HIDE_REASON_LABELS[h.hideReason]})` : ''}:{' '}
                {h.reason}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pedido por {h.requestedBy} · decidido por{' '}
                {h.decidedBy ?? 'administrador'} em {formatDateTime(h.createdAt)}
              </Typography>
            </ListItem>
          ))}
        </List>
      )}

      {editing && (
        <ModeDialog
          station={station}
          onClose={() => setEditing(false)}
          onDone={(mode) => {
            setEditing(false);
            onNotice(`${station.name}: ${STATION_MODE_LABELS[mode]}.`);
          }}
        />
      )}
    </Paper>
  );
}

function ModeDialog({
  station,
  onClose,
  onDone,
}: {
  station: AdminStation;
  onClose: () => void;
  onDone: (mode: StationMode) => void;
}) {
  const setMode = useSetStationMode(station.id);
  const [mode, setModeValue] = useState<StationMode>(station.mode);
  const [hideReason, setHideReason] = useState<HideReason | ''>('');
  const [requestedBy, setRequestedBy] = useState('');
  const [reason, setReason] = useState('');
  const needsReason = modeNeedsHideReason(mode);
  const reasons = HIDE_REASONS.filter((r) =>
    mode === 'oculto' ? r !== 'dado_incorreto' : r !== 'fechado',
  );
  const valid =
    mode !== station.mode &&
    (!needsReason || hideReason !== '') &&
    requestedBy.trim().length >= 3 &&
    reason.trim().length >= 5 &&
    !setMode.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setMode.mutate(
      {
        mode,
        hideReason: needsReason && hideReason !== '' ? hideReason : null,
        requestedBy: requestedBy.trim(),
        reason: reason.trim(),
      },
      { onSuccess: () => onDone(mode) },
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
      <DialogTitle sx={{ fontWeight: 700 }}>Exibição de {station.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Preço de combustível é informação pública. Esconder é exceção, só
            por motivo objetivo.
          </Alert>
          <FormControl>
            <FormLabel id="mode-label">Modo</FormLabel>
            <RadioGroup
              aria-labelledby="mode-label"
              value={mode}
              onChange={(event) => {
                setModeValue(event.target.value as StationMode);
                setHideReason('');
              }}
            >
              {STATION_MODES.map((m) => {
                const disabled = m === 'preco_oficial' && !station.network;
                return (
                  <FormControlLabel
                    key={m}
                    value={m}
                    disabled={disabled}
                    control={<Radio />}
                    sx={{ alignItems: 'flex-start', mt: 0.5 }}
                    label={
                      <Box sx={{ pt: 1 }}>
                        <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                          {STATION_MODE_LABELS[m]}
                          {m === station.mode ? ' (atual)' : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {disabled
                            ? 'Indisponível: o posto não tem rede no portal.'
                            : STATION_MODE_DESCRIPTIONS[m]}
                        </Typography>
                      </Box>
                    }
                  />
                );
              })}
            </RadioGroup>
          </FormControl>
          {needsReason && (
            <TextField
              select
              label="Motivo objetivo"
              value={hideReason}
              onChange={(event) => setHideReason(event.target.value as HideReason)}
              fullWidth
            >
              {reasons.map((r) => (
                <MenuItem key={r} value={r}>
                  {HIDE_REASON_LABELS[r]}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Quem pediu"
            placeholder="Ex.: proprietário, por telefone"
            value={requestedBy}
            onChange={(event) => setRequestedBy(event.target.value)}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          <TextField
            label="Motivo e detalhes"
            placeholder="Ex.: processo nº …; ou: posto fechado desde março."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
          {errorText(setMode.error) && (
            <Alert severity="error">{errorText(setMode.error)}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!valid}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
