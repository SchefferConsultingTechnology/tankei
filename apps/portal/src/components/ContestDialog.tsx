import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  FUEL_LABELS,
  formatPrice,
  type FuelType,
  type PriceHistoryEntry,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useContest } from '../api/queries';
import { atStationText } from './report-text';

/**
 * Contestação de informes de consumidores (ADR 0020). Os escolhidos saem do
 * preço exibido até a equipe Tankei decidir; nada é apagado.
 */
export function ContestDialog({
  stationId,
  fuel,
  candidates,
  preselected,
  onClose,
  onDone,
}: {
  stationId: string;
  fuel: FuelType;
  /** Informes contestáveis do combustível. */
  candidates: PriceHistoryEntry[];
  preselected: string[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const contest = useContest(stationId);
  const [selected, setSelected] = useState<string[]>(preselected);
  const [reason, setReason] = useState('');
  const canSend =
    selected.length > 0 && reason.trim().length >= 5 && !contest.isPending;

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    contest.mutate(
      { reportIds: selected, reason: reason.trim() },
      {
        onSuccess: () =>
          onDone(
            selected.length === 1
              ? 'Informe contestado. Ele não conta no preço até a equipe Tankei decidir.'
              : `${selected.length} informes contestados. Eles não contam no preço até a equipe Tankei decidir.`,
          ),
      },
    );
  }

  const error =
    contest.error instanceof ApiError
      ? contest.error.message
      : contest.error
        ? 'Não foi possível enviar. Tente de novo.'
        : null;

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={mobile}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { component: 'form', onSubmit: submit } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        Contestar informes · {FUEL_LABELS[fuel]}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          Os informes escolhidos deixam de contar no preço do app até a equipe
          Tankei analisar. Ela pode manter ou anular; você vê a decisão em
          Preços › Contestações. Os informes não são apagados.
        </DialogContentText>

        {candidates.length === 0 ? (
          <Alert severity="info">
            Nenhum informe de consumidor para contestar neste combustível.
          </Alert>
        ) : (
          <List dense aria-label="Informes de consumidores">
            {candidates.map((entry) => {
              const checked = selected.includes(entry.id);
              return (
                <ListItem key={entry.id} disablePadding>
                  <ListItemButton onClick={() => toggle(entry.id)} dense>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Checkbox
                        edge="start"
                        checked={checked}
                        tabIndex={-1}
                        disableRipple
                        slotProps={{
                          input: {
                            'aria-label': `R$ ${formatPrice(entry.price)}, ${entry.reporter}`,
                          },
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography component="span" sx={{ fontWeight: 700 }}>
                          R$ {formatPrice(entry.price)}
                        </Typography>
                      }
                      secondary={`${new Date(entry.reportedAt).toLocaleString(
                        'pt-BR',
                        {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )} · ${entry.reporter} · ${atStationText(entry)}`}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}

        <Box sx={{ mt: 2 }}>
          <TextField
            label="Motivo"
            placeholder="Ex.: nosso preço é R$ 6,19 desde segunda; o valor informado nunca foi praticado."
            helperText="A equipe Tankei lê antes de decidir."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={3}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!canSend}>
          {contest.isPending
            ? 'Enviando…'
            : selected.length > 1
              ? `Contestar ${selected.length} informes`
              : 'Contestar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
