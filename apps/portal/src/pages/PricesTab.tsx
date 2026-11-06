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
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  describePrice,
  FUEL_LABELS,
  FUEL_TYPES,
  formatPrice,
  formatUntil,
  type CurrentPrice,
  type FuelType,
  type Station,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import {
  usePriceHistory,
  useReportPrice,
  type PriceUpdate,
} from '../api/queries';
import { ContestDialog } from '../components/ContestDialog';
import { PriceTag } from '../components/PriceTag';

/** Preços vigentes da unidade, com atualização por combustível. */
export function PricesTab({
  station,
  canUpdate = true,
  canContest = false,
}: {
  station: Station;
  /** Somente leitura (ADR 0021): vê os preços, sem atualizar. */
  canUpdate?: boolean;
  /** Proprietário e gestor contestam informes (ADR 0020). */
  canContest?: boolean;
}) {
  const [editing, setEditing] = useState<FuelType | null>(null);
  const [contesting, setContesting] = useState<CurrentPrice | null>(null);
  const reconfirm = useReportPrice(station.id);
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
      {station.mode === 'preco_oficial' && (
        <Alert severity="info">
          Seu posto está em <strong>preço oficial</strong>: o preço que você
          informa sempre vale no app. Informes de consumidores diferentes
          aparecem como aviso, e a equipe Tankei acompanha divergências
          persistentes.
        </Alert>
      )}
      {station.mode === 'precos_ocultos' && (
        <Alert severity="warning">
          A pedido, os preços deste posto não são exibidos no Tankei.
        </Alert>
      )}

      {fuels.flatMap((fuel) => {
        const price = priceOf(fuel);
        const divergence = price?.divergence;
        if (!price || !divergence) return [];
        return [
          <Alert
            key={fuel}
            severity="warning"
            sx={{ '& .MuiAlert-message': { width: '100%' } }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {FUEL_LABELS[fuel]}: consumidores informaram R${' '}
              {formatPrice(divergence.price)}
            </Typography>
            <Typography variant="body2">
              {station.mode === 'preco_oficial'
                ? `O app continua mostrando o seu preço (R$ ${formatPrice(price.price)}), que é oficial: o aviso dos consumidores aparece junto. Se o seu preço está certo, reconfirme; se não, corrija.`
                : `O app continua mostrando o seu preço (R$ ${formatPrice(price.price)}) com esse aviso. Reconfirme ou conteste ${formatUntil(divergence.respondBy)}; sem resposta, o valor dos consumidores passa a valer.`}
            </Typography>
            {(canUpdate || canContest) && (
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ mt: 1, flexWrap: 'wrap' }}
              >
                {canUpdate && (
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    disabled={reconfirm.isPending}
                    onClick={() =>
                      reconfirm.mutate(
                        { fuelType: fuel, price: price.price, confirmed: true },
                        {
                          onSuccess: () =>
                            setNotice(
                              `Preço de ${FUEL_LABELS[fuel].toLowerCase()} reconfirmado: R$ ${formatPrice(price.price)}.`,
                            ),
                        },
                      )
                    }
                  >
                    Reconfirmar R$ {formatPrice(price.price)}
                  </Button>
                )}
                {canUpdate && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setEditing(fuel)}
                  >
                    Corrigir preço
                  </Button>
                )}
                {canContest && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setContesting(price)}
                  >
                    Contestar informes
                  </Button>
                )}
              </Stack>
            )}
          </Alert>,
        ];
      })}

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

      {contesting && (
        <DivergenceContest
          stationId={station.id}
          price={contesting}
          onClose={() => setContesting(null)}
          onDone={(message) => {
            setContesting(null);
            setNotice(message);
          }}
        />
      )}

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

/**
 * Contestação a partir da divergência: carrega os informes recentes do
 * combustível e já marca os do valor divergente.
 */
function DivergenceContest({
  stationId,
  price,
  onClose,
  onDone,
}: {
  stationId: string;
  price: CurrentPrice;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const history = usePriceHistory(stationId, price.fuelType, 7);
  if (!history.data) return null;
  const candidates = history.data.entries.filter((e) => e.contestable);
  const divergent = price.divergence?.price;
  return (
    <ContestDialog
      stationId={stationId}
      fuel={price.fuelType}
      candidates={candidates}
      preselected={candidates
        .filter((e) => divergent !== undefined && e.price === divergent)
        .map((e) => e.id)}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

/** "6,29" ou "6.299" → 6.299; nulo se inválido. */
function parsePrice(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
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
  const [confirming, setConfirming] = useState<string | null>(null);
  const price = parsePrice(text);
  const invalidText = text.trim() !== '' && price === null;

  function send(confirmed: boolean) {
    if (price === null) return;
    const body: PriceUpdate = { fuelType: fuel, price, confirmed };
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
  const canSend = price !== null && !report.isPending;

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

          <Typography variant="body2" color="text.secondary">
            Preço promocional com período e arte: Divulgação › Promoções.
          </Typography>

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
