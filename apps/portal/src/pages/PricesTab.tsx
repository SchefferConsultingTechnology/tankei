import EditOutlined from '@mui/icons-material/EditOutlined';
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  describePrice,
  FUEL_LABELS,
  FUEL_TYPES,
  formatPrice,
  type CurrentPrice,
  type FuelType,
  type Station,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useReportPrice, type PriceUpdate } from '../api/queries';
import { PriceTag } from '../components/PriceTag';

/** Preços vigentes da unidade, com atualização por combustível. */
export function PricesTab({
  station,
  canUpdate = true,
}: {
  station: Station;
  /** Somente leitura (ADR 0021): vê os preços, sem atualizar. */
  canUpdate?: boolean;
}) {
  const [editing, setEditing] = useState<FuelType | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fuels = FUEL_TYPES.filter((fuel) => station.fuels.includes(fuel));
  const priceOf = (fuel: FuelType) =>
    station.prices.find((p) => p.fuelType === fuel);

  if (fuels.length === 0) {
    return (
      <Alert severity="info">
        Os combustíveis deste posto ainda não foram informados pela ANP.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
        Preços atuais
      </Typography>

      <Paper variant="outlined">
        <List disablePadding aria-label="Preços por combustível">
          {fuels.map((fuel, index) => {
            const price = priceOf(fuel);
            return (
              <ListItem
                key={fuel}
                divider={index < fuels.length - 1}
                sx={{ gap: 1.5, alignItems: 'center', py: 1.5 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {FUEL_LABELS[fuel]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {price ? describePrice(price) : 'Sem preço informado'}
                  </Typography>
                  {price?.promotion && (
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<LocalOfferOutlined />}
                      label={price.promotion.label}
                      sx={{
                        mt: 0.5,
                        color: 'var(--badge-promocao)',
                        borderColor: 'var(--badge-promocao)',
                        '& .MuiChip-icon': { color: 'inherit' },
                      }}
                    />
                  )}
                </Box>
                <Stack spacing={1} sx={{ alignItems: 'flex-end' }}>
                  <PriceTag price={price} large />
                  {canUpdate && (
                    <Button
                      size="small"
                      startIcon={<EditOutlined />}
                      onClick={() => setEditing(fuel)}
                      aria-label={`Atualizar preço de ${FUEL_LABELS[fuel].toLowerCase()}`}
                    >
                      Atualizar
                    </Button>
                  )}
                </Stack>
              </ListItem>
            );
          })}
        </List>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        {canUpdate
          ? 'Os preços informados aqui aparecem no app com o selo “Atualizado pelo posto”. Correções criam um registro novo; o histórico é mantido.'
          : 'Seu papel na equipe permite ver os preços, sem alterá-los.'}
      </Typography>

      {editing && (
        <PriceDialog
          stationId={station.id}
          fuel={editing}
          current={priceOf(editing)}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      )}

      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
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

/** "6,29" ou "6.299" → 6.299; nulo se inválido. */
function parsePrice(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Valor para <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Novo preço (e promoção) de um combustível. Tela cheia no celular. */
function PriceDialog({
  stationId,
  fuel,
  current,
  onClose,
  onDone,
}: {
  stationId: string;
  fuel: FuelType;
  current: CurrentPrice | undefined;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const report = useReportPrice(stationId);
  const [text, setText] = useState(current ? formatPrice(current.price) : '');
  const [isPromotion, setIsPromotion] = useState(false);
  const [label, setLabel] = useState('');
  const [endsAt, setEndsAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 2 * 86_400_000)),
  );
  const [confirming, setConfirming] = useState<string | null>(null);
  const price = parsePrice(text);
  const invalidText = text.trim() !== '' && price === null;

  function send(confirmed: boolean) {
    if (price === null) return;
    const body: PriceUpdate = { fuelType: fuel, price, confirmed };
    if (isPromotion) {
      body.promotion = {
        label: label.trim(),
        startsAt: new Date().toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      };
    }
    setConfirming(null);
    report.mutate(body, {
      onSuccess: (result) => onDone(result.message),
      onError: (error) => {
        if (
          error instanceof ApiError &&
          error.code === 'CONFIRMATION_REQUIRED'
        ) {
          setConfirming(error.message);
        }
      },
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    send(false);
  }

  const error =
    report.error && !confirming
      ? report.error instanceof ApiError
        ? report.error.message
        : 'Não foi possível enviar. Tente de novo.'
      : null;
  const canSend =
    price !== null &&
    !report.isPending &&
    (!isPromotion || label.trim() !== '');

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={mobile}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { component: 'form', onSubmit: submit } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {FUEL_LABELS[fuel]}
        <Typography variant="body2" color="text.secondary" component="div">
          {current
            ? `Atual: R$ ${formatPrice(current.price)} · ${describePrice(current)}`
            : 'Ainda sem preço informado'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Novo preço por litro"
            placeholder="6,29"
            value={text}
            onChange={(event) => setText(event.target.value)}
            error={invalidText}
            helperText={
              invalidText ? 'Use números, com vírgula: 6,29' : undefined
            }
            autoFocus
            fullWidth
            slotProps={{
              htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">R$</InputAdornment>
                ),
              },
            }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={isPromotion}
                onChange={(event) => setIsPromotion(event.target.checked)}
              />
            }
            label="Preço promocional"
          />

          {isPromotion && (
            <>
              <TextField
                label="Nome da promoção"
                placeholder="Semana do motorista"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 60 } }}
              />
              <TextField
                label="Válida até"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </>
          )}

          {confirming && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => send(true)}
                  disabled={report.isPending}
                >
                  Está correto
                </Button>
              }
            >
              {confirming}
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!canSend}>
          {report.isPending ? 'Publicando…' : 'Publicar preço'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
