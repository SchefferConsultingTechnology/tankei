import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlined';
import HighlightOff from '@mui/icons-material/HighlightOffOutlined';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  FUEL_LABELS,
  formatPrice,
  MODERATION_KIND_LABELS,
  MODERATION_STATUS_LABELS,
  type AdminModerationCase,
  type ModerationDecision,
  type ModerationReport,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { useDecideModeration, useModeration } from '../api/admin-queries';
import { errorText, formatDateTime, useMobile } from '../components/hooks';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';

type View = 'em_analise' | 'decididos';

function where(r: ModerationReport) {
  if (r.atStation === true) return 'No posto';
  if (r.atStation === false) return 'Longe';
  return 'Sem localização';
}

function account(r: ModerationReport) {
  const age =
    r.reporterAccountDays === null
      ? ''
      : r.reporterAccountDays === 0
        ? ' (criada no dia)'
        : ` (${r.reporterAccountDays} d)`;
  if (r.trusted === null) return `Anterior à regra${age}`;
  return `${r.trusted ? 'Confiável' : 'Nova ou sem histórico'}${age}`;
}

/** Fila de moderação de informes de preço (ADR 0020 e 0024). */
export function ModerationPage() {
  const [view, setView] = useState<View>('em_analise');
  const cases = useModeration(view);
  const open = useModeration('em_analise');
  const [deciding, setDeciding] = useState<{
    item: AdminModerationCase;
    decision: ModerationDecision;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Moderação de preços"
        subtitle="Contestações dos postos e rajadas detectadas. Enquanto um caso está em análise, os informes não contam no preço do app."
      />
      <Tabs
        value={view}
        onChange={(_, value: View) => setView(value)}
        aria-label="Situação"
      >
        <Tab
          value="em_analise"
          label={
            (open.data?.length ?? 0) > 0 ? (
              <Badge
                badgeContent={open.data?.length}
                color="secondary"
                sx={{ pr: 1.5 }}
              >
                Em análise
              </Badge>
            ) : (
              'Em análise'
            )
          }
        />
        <Tab value="decididos" label="Decididos" />
      </Tabs>

      {cases.isPending && <PageLoading />}
      {cases.isError && <Alert severity="error">{cases.error.message}</Alert>}
      {cases.data?.length === 0 && (
        <Alert severity="info">
          {view === 'em_analise'
            ? 'Nenhum caso aguardando análise.'
            : 'Nenhum caso decidido ainda.'}
        </Alert>
      )}

      {cases.data?.map((item) => (
        <CaseCard
          key={item.id}
          item={item}
          onDecide={(decision) => setDeciding({ item, decision })}
        />
      ))}

      {deciding && (
        <DecideDialog
          item={deciding.item}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setNotice(
              deciding.decision === 'anulado'
                ? 'Informes anulados: não contam mais no preço.'
                : 'Informes mantidos: voltam a contar no preço.',
            );
            setDeciding(null);
          }}
        />
      )}
      <Notice message={notice} onClose={() => setNotice(null)} />
    </Stack>
  );
}

function CaseCard({
  item,
  onDecide,
}: {
  item: AdminModerationCase;
  onDecide: (decision: ModerationDecision) => void;
}) {
  const pending = item.status === 'em_analise';
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>
            <Link
              component={RouterLink}
              to={`/postos/${item.station.id}`}
              underline="hover"
              color="inherit"
            >
              {item.station.name}
            </Link>{' '}
            · {FUEL_LABELS[item.fuelType]}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {item.station.city}/{item.station.state} ·{' '}
            {formatDateTime(item.createdAt)}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}
        >
          <Chip
            size="small"
            color={item.kind === 'rajada' ? 'warning' : 'primary'}
            variant="outlined"
            label={MODERATION_KIND_LABELS[item.kind]}
          />
          {!pending && (
            <Chip
              size="small"
              label={MODERATION_STATUS_LABELS[item.status]}
              color={item.status === 'anulado' ? 'error' : 'default'}
            />
          )}
        </Stack>
      </Stack>

      <Typography variant="body2" sx={{ mt: 1.5 }}>
        {item.kind === 'contestacao' ? (
          <>
            <strong>{item.openedBy ?? 'Posto'}</strong>: {item.reason}
          </>
        ) : (
          item.reason
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {item.stationPrice
          ? `Último preço do posto: R$ ${formatPrice(item.stationPrice.price)}, ${formatDateTime(item.stationPrice.reportedAt)}`
          : 'O posto ainda não informou preço deste combustível.'}
      </Typography>

      <Box sx={{ overflowX: 'auto', mt: 1.5 }}>
        <Table size="small" aria-label="Informes do caso">
          <TableHead>
            <TableRow>
              <TableCell>Valor</TableCell>
              <TableCell>Quando</TableCell>
              <TableCell>Consumidor</TableCell>
              <TableCell>Onde</TableCell>
              <TableCell>Conta</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {item.reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell
                  sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  R$ {formatPrice(r.price)}
                  {r.status === 'suspeito' && (
                    <Chip
                      size="small"
                      color="warning"
                      label="suspeito"
                      sx={{ ml: 1 }}
                    />
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDateTime(r.reportedAt)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {r.reporter.replace('Consumidor ', '')}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{where(r)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{account(r)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {item.decision && (
        <Alert
          severity={item.decision.decision === 'anulado' ? 'error' : 'info'}
          sx={{ mt: 1.5 }}
        >
          {MODERATION_STATUS_LABELS[item.decision.decision]} por{' '}
          {item.decision.decidedBy ?? 'equipe Tankei'},{' '}
          {formatDateTime(item.decision.decidedAt)}: {item.decision.reason}
        </Alert>
      )}

      {pending && (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ justifyContent: 'flex-end', mt: 2, flexWrap: 'wrap' }}
        >
          <Button
            startIcon={<CheckCircleOutline />}
            onClick={() => onDecide('mantido')}
          >
            Manter informes
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<HighlightOff />}
            onClick={() => onDecide('anulado')}
          >
            Anular informes
          </Button>
        </Stack>
      )}
    </Paper>
  );
}

function DecideDialog({
  item,
  decision,
  onClose,
  onDone,
}: {
  item: AdminModerationCase;
  decision: ModerationDecision;
  onClose: () => void;
  onDone: () => void;
}) {
  const decide = useDecideModeration();
  const [reason, setReason] = useState('');
  const annul = decision === 'anulado';
  const valid = reason.trim().length >= 5 && !decide.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    decide.mutate(
      { caseId: item.id, decision, reason: reason.trim() },
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
        {annul ? 'Anular informes' : 'Manter informes'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {annul
            ? `Os ${item.reports.length} informes deixam de contar no preço de ${item.station.name}, de vez. Eles continuam no registro.`
            : `Os ${item.reports.length} informes voltam a contar no preço de ${item.station.name}.`}
        </DialogContentText>
        <TextField
          label="Explicação"
          helperText="O posto vê este texto no portal."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={3}
          fullWidth
          autoFocus
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        {errorText(decide.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(decide.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          variant="contained"
          color={annul ? 'error' : 'primary'}
          disabled={!valid}
        >
          {annul ? 'Anular' : 'Manter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
