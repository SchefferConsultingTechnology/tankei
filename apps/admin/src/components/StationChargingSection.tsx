import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import {
  CHARGER_CURRENT_LABELS,
  CONNECTOR_LABELS,
  type ChargerCurrent,
  type ChargingAdmin,
} from '@tankei/shared';
import { useState } from 'react';
import { ApiError } from '../api/client';
import {
  useAdminCharging,
  useDismissChargerSuggestions,
  useSetAdminCharging,
} from '../api/admin-queries';
import { ChargersEditor } from './ChargersEditor';
import { PageLoading } from './PageLoading';

function summary(data: ChargingAdmin): string {
  if (data.official) {
    const n = data.official.chargers.length;
    return n === 0
      ? `Sem recarga (informado ${data.official.source === 'posto' ? 'pelo posto' : 'pela equipe'})`
      : `${n} tipo(s) de ponto, ${data.official.source === 'posto' ? 'pelo posto' : 'pela equipe'}`;
  }
  if (data.suggestions.length > 0) {
    return `Sugestões de motoristas: ${data.suggestions.map((s) => `${s.current.toUpperCase()} (${s.people})`).join(', ')}`;
  }
  return 'Sem recarga informada';
}

/**
 * Recarga elétrica pela equipe (ADR 0041): cadastro oficial para postos do
 * piloto sem responsável e descarte de sugestões erradas de motoristas.
 */
export function StationChargingSection({
  stationId,
  onNotice,
}: {
  stationId: string;
  onNotice: (message: string) => void;
}) {
  const charging = useAdminCharging(stationId);
  const save = useSetAdminCharging(stationId);
  const dismiss = useDismissChargerSuggestions(stationId);
  const [reason, setReason] = useState('');

  const dismissOne = (current: ChargerCurrent) =>
    dismiss.mutate(
      { current, reason },
      {
        onSuccess: () => {
          setReason('');
          onNotice(`Sugestões de ${CHARGER_CURRENT_LABELS[current]} descartadas.`);
        },
      },
    );

  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
        <div>
          <Typography sx={{ fontWeight: 700 }}>Recarga elétrica</Typography>
          {charging.data && (
            <Typography variant="body2" color="text.secondary">
              {summary(charging.data)}
            </Typography>
          )}
        </div>
      </AccordionSummary>
      <AccordionDetails>
        {charging.isPending ? (
          <PageLoading />
        ) : charging.isError ? (
          <Alert severity="error">{charging.error.message}</Alert>
        ) : (
          <Stack spacing={2}>
            {charging.data.suggestions.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Sugestões de motoristas (aparecem com{' '}
                  {charging.data.minConfirmations} ou mais pessoas)
                </Typography>
                {charging.data.suggestions.map((s) => (
                  <Stack
                    key={s.current}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                  >
                    <Typography variant="body2">
                      {CHARGER_CURRENT_LABELS[s.current]}: {s.people}{' '}
                      {s.people === 1 ? 'pessoa' : 'pessoas'}
                      {s.connectors.length > 0 &&
                        ` · ${s.connectors.map((c) => CONNECTOR_LABELS[c]).join(', ')}`}
                      {s.confirmed ? ' · aparece no app' : ' · aguardando confirmação'}
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      disabled={reason.trim().length < 3 || dismiss.isPending}
                      onClick={() => dismissOne(s.current)}
                    >
                      Descartar
                    </Button>
                  </Stack>
                ))}
                <TextField
                  size="small"
                  label="Motivo do descarte"
                  placeholder="Ex.: conferido em campo, o posto não tem recarga"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
                {dismiss.error && (
                  <Alert severity="error">{dismiss.error.message}</Alert>
                )}
                <Divider />
              </Stack>
            )}
            <ChargersEditor
              key={charging.data.official?.updatedAt ?? 'novo'}
              data={charging.data}
              canEdit
              saving={save.isPending}
              error={
                save.error
                  ? save.error instanceof ApiError
                    ? save.error.message
                    : 'Não foi possível salvar.'
                  : null
              }
              onSave={(body) =>
                save.mutate(body, {
                  onSuccess: () => onNotice('Recarga do posto salva.'),
                })
              }
            />
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
