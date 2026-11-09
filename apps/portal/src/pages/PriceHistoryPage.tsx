import GavelOutlined from '@mui/icons-material/GavelOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {
  FUEL_LABELS,
  FUEL_TYPES,
  formatPrice,
  formatUntil,
  MODERATION_KIND_LABELS,
  type FuelType,
  type ModerationStatus,
  type PriceHistoryEntry,
  type PriceReportStatus,
} from '@tankei/shared';
import { useState } from 'react';
import { usePriceHistory } from '../api/queries';
import { ContestDialog } from '../components/ContestDialog';
import { atStationText } from '../components/report-text';
import { useCan, useStationContext } from './station-context';
import { PageLoading } from '../components/PageLoading';

const PERIODS = [7, 30, 90] as const;

const STATUS: Record<
  PriceReportStatus,
  { label: string; color: 'success' | 'warning' | 'error' }
> = {
  valido: { label: 'Válido', color: 'success' },
  suspeito: { label: 'Suspeito', color: 'warning' },
  rejeitado: { label: 'Rejeitado', color: 'error' },
};

const MODERATION: Record<
  ModerationStatus,
  { label: string; color: 'warning' | 'default' | 'error' }
> = {
  em_analise: { label: 'em análise', color: 'warning' },
  mantido: { label: 'mantido', color: 'default' },
  anulado: { label: 'anulado', color: 'error' },
};

/**
 * Histórico dos informes de preço do posto (ADR 0020): do posto e dos
 * consumidores, com a situação e qual define o preço exibido agora.
 */
export function PriceHistoryPage() {
  const { station } = useStationContext();
  const [fuel, setFuel] = useState<FuelType | 'todos'>('todos');
  const [days, setDays] = useState<number>(30);
  const history = usePriceHistory(
    station.id,
    fuel === 'todos' ? null : fuel,
    days,
  );
  const fuels = FUEL_TYPES.filter((f) => station.fuels.includes(f));
  const entries = history.data?.entries ?? [];
  const canContest = useCan('contest');
  const [contesting, setContesting] = useState<PriceHistoryEntry | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
        Histórico de preços
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <TextField
          select
          size="small"
          label="Combustível"
          value={fuel}
          onChange={(event) =>
            setFuel(event.target.value as FuelType | 'todos')
          }
          sx={{ flex: 1, maxWidth: { sm: 320 } }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          {fuels.map((f) => (
            <MenuItem key={f} value={f}>
              {FUEL_LABELS[f]}
            </MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={days}
          onChange={(_, value: number | null) => value && setDays(value)}
          aria-label="Período"
        >
          {PERIODS.map((p) => (
            <ToggleButton
              key={p}
              value={p}
              sx={{ flex: { xs: 1, sm: 'none' }, px: 2 }}
            >
              {p} dias
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {history.isPending && (
        <PageLoading />
      )}
      {history.isError && (
        <Alert severity="error">{history.error.message}</Alert>
      )}
      {history.isSuccess && entries.length === 0 && (
        <Alert severity="info">Nenhum preço informado no período.</Alert>
      )}

      {entries.length > 0 && (
        <Paper variant="outlined">
          <List disablePadding aria-label="Preços informados">
            {entries.map((entry, index) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                showFuel={fuel === 'todos'}
                divider={index < entries.length - 1}
                onContest={
                  canContest && entry.contestable
                    ? () => setContesting(entry)
                    : undefined
                }
              />
            ))}
          </List>
        </Paper>
      )}

      <Typography variant="body2" color="text.secondary">
        Consumidores aparecem com um apelido (o mesmo para a mesma pessoa neste
        posto), sem nome. Informes suspeitos só entram no preço depois de
        confirmados; rejeitados nunca entram. Informes contestados ficam fora do
        preço até a equipe Tankei decidir. Nada é apagado: correções criam um
        registro novo.
      </Typography>

      {contesting && (
        <ContestDialog
          stationId={station.id}
          fuel={contesting.fuelType}
          candidates={entries.filter(
            (e) => e.contestable && e.fuelType === contesting.fuelType,
          )}
          preselected={entries
            .filter(
              (e) =>
                e.contestable &&
                e.fuelType === contesting.fuelType &&
                e.price === contesting.price,
            )
            .map((e) => e.id)}
          onClose={() => setContesting(null)}
          onDone={(message) => {
            setContesting(null);
            setNotice(message);
          }}
        />
      )}
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

function HistoryRow({
  entry,
  showFuel,
  divider,
  onContest,
}: {
  entry: PriceHistoryEntry;
  showFuel: boolean;
  divider: boolean;
  onContest?: () => void;
}) {
  const status = STATUS[entry.status];
  const when = new Date(entry.reportedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ListItem
      divider={divider}
      sx={{
        gap: 1.5,
        alignItems: 'flex-start',
        bgcolor: entry.current ? 'action.selected' : undefined,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            R$ {formatPrice(entry.price)}
          </Typography>
          {showFuel && (
            <Typography variant="body2" color="text.secondary">
              {FUEL_LABELS[entry.fuelType]}
            </Typography>
          )}
          {entry.current && (
            <Chip label="Em vigor" size="small" color="primary" />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {when} · {entry.reporter}
          {entry.source === 'usuario' && ` · ${atStationText(entry)}`}
        </Typography>
        {entry.moderation && (
          <Chip
            size="small"
            variant="outlined"
            color={MODERATION[entry.moderation.status].color}
            icon={<GavelOutlined />}
            label={`${MODERATION_KIND_LABELS[entry.moderation.kind]}: ${MODERATION[entry.moderation.status].label}`}
            sx={{ mt: 0.5 }}
          />
        )}
        {onContest && (
          <Button
            size="small"
            onClick={onContest}
            sx={{ mt: 0.5, ml: -0.5, display: 'block' }}
          >
            Contestar
          </Button>
        )}
        {entry.promotion && (
          <Typography variant="body2" color="text.secondary">
            Promoção “{entry.promotion.label}”{' '}
            {formatUntil(entry.promotion.endsAt)}
          </Typography>
        )}
      </Box>
      <Chip
        label={status.label}
        size="small"
        color={status.color}
        variant="outlined"
        sx={{ flexShrink: 0, fontWeight: 700 }}
      />
    </ListItem>
  );
}
