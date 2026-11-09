import AddOutlined from '@mui/icons-material/AddOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  FUEL_LABELS,
  FUEL_TYPES,
  formatPrice,
  formatUntil,
  PROMOTION_STATUS_LABELS,
  type FuelType,
  type PromotionStatus,
  type StationPromotion,
} from '@tankei/shared';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import {
  useCreatePromotion,
  useEndPromotion,
  usePromotionImage,
  useStationPromotions,
  type NewPromotion,
} from '../api/queries';
import { useCan, useStationContext } from './station-context';
import { PageLoading } from '../components/PageLoading';

const ORDER: PromotionStatus[] = ['vigente', 'agendada', 'encerrada'];

const STATUS_COLOR: Record<PromotionStatus, 'success' | 'info' | 'default'> = {
  vigente: 'success',
  agendada: 'info',
  encerrada: 'default',
};

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir. Tente de novo.';
}

function when(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function period(p: StationPromotion) {
  if (p.status === 'vigente') return `Vigente ${formatUntil(p.endsAt)}`;
  if (p.status === 'agendada') return `De ${when(p.startsAt)} a ${when(p.endsAt)}`;
  return `Encerrada em ${when(p.endsAt)}`;
}

/** Promoções do posto com arte e preços (ADR 0026). */
export function PromotionsPage() {
  const { station } = useStationContext();
  const canManage = useCan('manage_promotions');
  const promotions = useStationPromotions(station.id);
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState<StationPromotion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const groups = ORDER.map((status) => ({
    status,
    items: promotions.data?.filter((p) => p.status === status) ?? [],
  })).filter((g) => g.items.length > 0);

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            Promoções
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aparecem na ficha do posto no app, com a arte. Preços promocionais
            valem no mapa e na lista durante o período.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setCreating(true)}
            sx={{ flexShrink: 0 }}
          >
            Nova
          </Button>
        )}
      </Stack>

      {promotions.isPending && (
        <PageLoading />
      )}
      {promotions.isError && (
        <Alert severity="error">{promotions.error.message}</Alert>
      )}
      {promotions.data?.length === 0 && (
        <Alert severity="info" icon={<LocalOfferOutlined />}>
          Nenhuma promoção nos últimos 90 dias.
          {canManage && ' Crie a primeira em “Nova”.'}
        </Alert>
      )}

      {groups.map((group) => (
        <Stack key={group.status} spacing={1.5}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ fontWeight: 700 }}
          >
            {PROMOTION_STATUS_LABELS[group.status]}s
          </Typography>
          {group.items.map((p) => (
            <PromotionCard
              key={p.id}
              stationId={station.id}
              promotion={p}
              canManage={canManage}
              onEnd={() => setEnding(p)}
              onNotice={setNotice}
            />
          ))}
        </Stack>
      ))}

      {creating && (
        <CreateDialog
          stationId={station.id}
          fuels={FUEL_TYPES.filter((f) => station.fuels.includes(f))}
          onClose={() => setCreating(false)}
          onDone={(message) => {
            setCreating(false);
            setNotice(message);
          }}
        />
      )}
      {ending && (
        <EndDialog
          stationId={station.id}
          promotion={ending}
          onClose={() => setEnding(null)}
          onDone={() => {
            setNotice(`Promoção “${ending.title}” encerrada.`);
            setEnding(null);
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

function PromotionCard({
  stationId,
  promotion: p,
  canManage,
  onEnd,
  onNotice,
}: {
  stationId: string;
  promotion: StationPromotion;
  canManage: boolean;
  onEnd: () => void;
  onNotice: (message: string) => void;
}) {
  const upload = usePromotionImage(stationId);
  const input = useRef<HTMLInputElement>(null);
  const active = p.status !== 'encerrada';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '160px minmax(0, 1fr)' },
        opacity: active ? 1 : 0.75,
      }}
    >
      <Box
        sx={{
          aspectRatio: '4 / 3',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.disabled',
        }}
      >
        {p.imageUrl ? (
          <Box
            component="img"
            src={p.imageUrl}
            alt={`Arte da promoção ${p.title}`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ImageOutlined fontSize="large" aria-label="Sem arte" />
        )}
      </Box>

      <Stack spacing={1} sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }}>{p.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {period(p)}
              {p.createdBy ? ` · por ${p.createdBy.split(' ')[0]}` : ''}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            color={STATUS_COLOR[p.status]}
            label={PROMOTION_STATUS_LABELS[p.status]}
            sx={{ flexShrink: 0, fontWeight: 700 }}
          />
        </Stack>
        {p.description && (
          <Typography variant="body2">{p.description}</Typography>
        )}
        {p.prices.length > 0 && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {p.prices.map((price) => (
              <Chip
                key={price.fuelType}
                size="small"
                icon={<LocalOfferOutlined />}
                label={`${FUEL_LABELS[price.fuelType]} R$ ${formatPrice(price.price)}`}
                sx={{
                  color: 'var(--badge-promocao)',
                  borderColor: 'var(--badge-promocao)',
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
                variant="outlined"
              />
            ))}
          </Stack>
        )}
        {p.imageRemovedReason && (
          <Alert severity="warning">
            A equipe Tankei removeu a arte: {p.imageRemovedReason}
          </Alert>
        )}
        {errorText(upload.error) && (
          <Alert severity="error">{errorText(upload.error)}</Alert>
        )}

        {canManage && active && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                upload.mutate(
                  { promotionId: p.id, file },
                  { onSuccess: () => onNotice('Arte publicada.') },
                );
              }}
            />
            <Button
              size="small"
              startIcon={<ImageOutlined />}
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {upload.isPending
                ? 'Enviando…'
                : p.imageUrl
                  ? 'Trocar arte'
                  : 'Enviar arte'}
            </Button>
            <Button size="small" color="error" onClick={onEnd}>
              Encerrar agora
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

/** Valor para <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function parsePrice(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function CreateDialog({
  stationId,
  fuels,
  onClose,
  onDone,
}: {
  stationId: string;
  fuels: FuelType[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const create = useCreatePromotion(stationId);
  const upload = usePromotionImage(stationId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 2 * 86_400_000)),
  );
  const [prices, setPrices] = useState<Partial<Record<FuelType, string>>>({});
  const [image, setImage] = useState<File | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const invalidPrice = Object.values(prices).some(
    (text) => text && text.trim() !== '' && parsePrice(text) === null,
  );
  const canSend =
    title.trim().length >= 3 &&
    !invalidPrice &&
    !create.isPending &&
    !upload.isPending;

  function send(confirmed: boolean) {
    const body: NewPromotion = {
      title: title.trim(),
      description: description.trim() || undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      prices: Object.entries(prices).flatMap(([fuel, text]) => {
        const price = text ? parsePrice(text) : null;
        return price === null ? [] : [{ fuelType: fuel as FuelType, price }];
      }),
      confirmed,
    };
    setConfirming(null);
    create.mutate(body, {
      onSuccess: (created) => {
        if (!image) {
          onDone(`Promoção “${created.title}” publicada.`);
          return;
        }
        upload.mutate(
          { promotionId: created.id, file: image },
          {
            onSuccess: () =>
              onDone(`Promoção “${created.title}” publicada com a arte.`),
            onError: () =>
              onDone(
                `Promoção “${created.title}” publicada, mas a arte não foi enviada. Tente de novo pelo cartão.`,
              ),
          },
        );
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'CONFIRMATION_REQUIRED') {
          setConfirming(error.message);
        }
      },
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (canSend) send(false);
  }

  const error = confirming ? null : errorText(create.error);

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={mobile}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { component: 'form', onSubmit: submit } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Nova promoção</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Título"
            placeholder="Semana do motorista"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            fullWidth
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
          <TextField
            label="Descrição (opcional)"
            placeholder="Ex.: lavagem grátis no abastecimento acima de 30 litros."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Início"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Fim"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Preços promocionais (opcional)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Deixe em branco os combustíveis sem desconto.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              }}
            >
              {fuels.map((fuel) => {
                const text = prices[fuel] ?? '';
                const invalid = text.trim() !== '' && parsePrice(text) === null;
                return (
                  <TextField
                    key={fuel}
                    label={FUEL_LABELS[fuel]}
                    value={text}
                    onChange={(event) =>
                      setPrices({ ...prices, [fuel]: event.target.value })
                    }
                    error={invalid}
                    helperText={invalid ? 'Use números: 5,99' : undefined}
                    size="small"
                    slotProps={{
                      htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">R$</InputAdornment>
                        ),
                      },
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          <Box>
            <Button component="label" startIcon={<ImageOutlined />}>
              {image ? 'Trocar arte' : 'Escolher arte (opcional)'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              />
            </Button>
            {image && (
              <Typography variant="body2" color="text.secondary">
                {image.name}
              </Typography>
            )}
          </Box>

          {confirming && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => send(true)}
                  disabled={create.isPending}
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
          {create.isPending || upload.isPending ? 'Publicando…' : 'Publicar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EndDialog({
  stationId,
  promotion,
  onClose,
  onDone,
}: {
  stationId: string;
  promotion: StationPromotion;
  onClose: () => void;
  onDone: () => void;
}) {
  const end = useEndPromotion(stationId);
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Encerrar agora?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          “{promotion.title}” sai do app agora
          {promotion.prices.length > 0
            ? ' e os preços promocionais deixam de valer'
            : ''}
          .
        </DialogContentText>
        {errorText(end.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(end.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Voltar</Button>
        <Button
          variant="contained"
          color="error"
          disabled={end.isPending}
          onClick={() => end.mutate(promotion.id, { onSuccess: onDone })}
        >
          Encerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
