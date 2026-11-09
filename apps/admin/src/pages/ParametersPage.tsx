import EditOutlined from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  PARAMETER_GROUP_LABELS,
  PARAMETER_UNIT_LABELS,
  type AdminParameter,
  type ParameterUnit,
} from '@tankei/shared';
import { Fragment, useState, type FormEvent } from 'react';
import {
  useParameterHistory,
  useParameters,
  useUpdateParameter,
} from '../api/admin-queries';
import { errorText, formatDateTime, useMobile } from '../components/hooks';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';

function formatValue(value: number, unit: ParameterUnit): string {
  const number = value.toLocaleString('pt-BR');
  if (unit === 'percent') return `${number}%`;
  const label = PARAMETER_UNIT_LABELS[unit];
  if (unit === 'hours' || unit === 'days') {
    return `${number} ${value === 1 ? label.slice(0, -1) : label}`;
  }
  return label ? `${number} ${label}` : number;
}

function changedText(p: { changedBy: string | null; changedAt: string }) {
  return `${formatDateTime(p.changedAt)} · ${p.changedBy ?? 'valor inicial do sistema'}`;
}

/** Parâmetros das regras de negócio (ADR 0006), por grupo. */
export function ParametersPage() {
  const parameters = useParameters();
  const [editing, setEditing] = useState<AdminParameter | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const groups = Object.keys(PARAMETER_GROUP_LABELS)
    .map((group) => ({
      group,
      items: parameters.data?.filter((p) => p.group === group) ?? [],
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Parâmetros"
        subtitle="Regras de negócio ajustáveis sem nova versão. Cada alteração fica no histórico, com o motivo, e vale em até um minuto."
      />

      {parameters.isPending && <PageLoading />}
      {parameters.isError && (
        <Alert severity="error">{parameters.error.message}</Alert>
      )}

      {groups.map(({ group, items }) => (
        <Box key={group}>
          <Typography
            variant="overline"
            color="text.secondary"
            component="h2"
            sx={{ fontWeight: 700 }}
          >
            {PARAMETER_GROUP_LABELS[group]}
          </Typography>
          <Paper variant="outlined">
            <List disablePadding>
              {items.map((p, index) => (
                <Fragment key={p.key}>
                  {index > 0 && <Divider component="li" />}
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => setEditing(p)}
                      sx={{
                        py: 1.5,
                        gap: 2,
                        alignItems: 'flex-start',
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                      }}
                    >
                      <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }}>
                          {p.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {p.description}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {changedText(p)}
                          {p.changes > 1 && ` · ${p.changes - 1} alteração(ões)`}
                        </Typography>
                      </Box>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', flexShrink: 0 }}
                      >
                        <Typography
                          sx={{
                            fontWeight: 700,
                            fontSize: '1.15rem',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatValue(p.value, p.unit)}
                        </Typography>
                        <EditOutlined fontSize="small" color="action" />
                      </Stack>
                    </ListItemButton>
                  </ListItem>
                </Fragment>
              ))}
            </List>
          </Paper>
        </Box>
      ))}

      {editing && (
        <EditDialog
          parameter={editing}
          onClose={() => setEditing(null)}
          onDone={(updated) => {
            setNotice(
              `${updated.label}: ${formatValue(updated.value, updated.unit)}. Vale em até um minuto.`,
            );
            setEditing(null);
          }}
        />
      )}
      <Notice message={notice} onClose={() => setNotice(null)} />
    </Stack>
  );
}

function EditDialog({
  parameter,
  onClose,
  onDone,
}: {
  parameter: AdminParameter;
  onClose: () => void;
  onDone: (updated: AdminParameter) => void;
}) {
  const update = useUpdateParameter();
  const history = useParameterHistory(parameter.key);
  const [text, setText] = useState(String(parameter.value).replace('.', ','));
  const [reason, setReason] = useState('');
  const value = Number(text.trim().replace(',', '.'));
  const validNumber = text.trim() !== '' && Number.isFinite(value);
  const unchanged = validNumber && value === parameter.value;
  const canSave =
    validNumber && !unchanged && reason.trim().length >= 5 && !update.isPending;
  const unit = PARAMETER_UNIT_LABELS[parameter.unit];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    update.mutate(
      { key: parameter.key, value, reason: reason.trim() },
      { onSuccess: onDone },
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
        {parameter.label}
        <Typography variant="body2" color="text.secondary" component="div">
          {parameter.description}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Novo valor"
            value={text}
            onChange={(event) => setText(event.target.value)}
            error={text.trim() !== '' && !validNumber}
            helperText={
              unchanged
                ? `Valor atual: ${formatValue(parameter.value, parameter.unit)}`
                : parameter.unit === 'percent'
                  ? 'Entre 0 e 100.'
                  : 'Número inteiro maior que zero.'
            }
            autoFocus
            fullWidth
            slotProps={{
              htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
              input: unit
                ? {
                    endAdornment: (
                      <InputAdornment position="end">{unit}</InputAdornment>
                    ),
                  }
                : undefined,
            }}
          />
          <TextField
            label="Motivo da alteração"
            placeholder="Ex.: muitos avisos de confirmação em postos com preço estável"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            helperText="Fica no histórico, com seu nome."
            multiline
            minRows={2}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
          {errorText(update.error) && (
            <Alert severity="error">{errorText(update.error)}</Alert>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Histórico
            </Typography>
            {history.isPending && (
              <PageLoading />
            )}
            <List dense disablePadding>
              {history.data?.map((change) => (
                <ListItem
                  key={change.changedAt}
                  disableGutters
                  sx={{ alignItems: 'flex-start', gap: 2 }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      minWidth: 72,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatValue(change.value, parameter.unit)}
                  </Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2">{change.reason}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {changedText(change)}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!canSave}>
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
