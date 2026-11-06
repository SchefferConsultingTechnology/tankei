import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  FUEL_LABELS,
  formatPrice,
  MODERATION_KIND_LABELS,
  MODERATION_STATUS_LABELS,
  type ModerationStatus,
  type StationModerationCase,
} from '@tankei/shared';
import { useStationModeration } from '../api/queries';
import { useStationContext } from './station-context';

const STATUS_COLOR: Record<
  ModerationStatus,
  'warning' | 'success' | 'default'
> = {
  em_analise: 'warning',
  anulado: 'success',
  mantido: 'default',
};

function when(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Contestações do posto e rajadas detectadas (ADR 0020), com a decisão da
 * equipe Tankei. Para contestar, use Histórico ou o aviso em Preços atuais.
 */
export function ContestsPage() {
  const { station } = useStationContext();
  const cases = useStationModeration(station.id);

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          Contestações
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Informes contestados ficam fora do preço do app até a equipe Tankei
          decidir. Anulados deixam de contar; mantidos voltam a contar. Para
          contestar, abra o Histórico.
        </Typography>
      </Box>

      {cases.isPending && (
        <Typography color="text.secondary">Carregando…</Typography>
      )}
      {cases.isError && <Alert severity="error">{cases.error.message}</Alert>}
      {cases.data?.length === 0 && (
        <Alert severity="info">Nenhuma contestação nos últimos 90 dias.</Alert>
      )}

      {cases.data && cases.data.length > 0 && (
        <Paper variant="outlined">
          <List disablePadding>
            {cases.data.map((c, index) => (
              <CaseRow
                key={c.id}
                item={c}
                divider={index < cases.data.length - 1}
              />
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  );
}

function CaseRow({
  item,
  divider,
}: {
  item: StationModerationCase;
  divider: boolean;
}) {
  const prices = item.prices.map((p) => `R$ ${formatPrice(p)}`).join(', ');
  return (
    <ListItem
      divider={divider}
      sx={{ display: 'block', py: 1.5 }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>
            {FUEL_LABELS[item.fuelType]} · {prices}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {MODERATION_KIND_LABELS[item.kind]} · {item.reports}{' '}
            {item.reports === 1 ? 'informe' : 'informes'} · {when(item.createdAt)}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color={STATUS_COLOR[item.status]}
          label={MODERATION_STATUS_LABELS[item.status]}
          sx={{ flexShrink: 0, fontWeight: 700 }}
        />
      </Stack>
      {item.reason && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {item.kind === 'contestacao' ? 'Motivo do posto: ' : ''}
          {item.reason}
        </Typography>
      )}
      {item.decisionReason && (
        <Alert
          severity={item.status === 'anulado' ? 'success' : 'info'}
          sx={{ mt: 1 }}
        >
          Equipe Tankei{item.decidedAt ? `, ${when(item.decidedAt)}` : ''}:{' '}
          {item.decisionReason}
        </Alert>
      )}
    </ListItem>
  );
}
