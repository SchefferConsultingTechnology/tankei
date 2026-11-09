import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import { STATION_FEATURE_LABELS } from '@tankei/shared';
import { useState } from 'react';
import { ApiError } from '../api/client';
import {
  useSetStationFeature,
  useStationFeatures,
} from '../api/admin-queries';
import { PageLoading } from './PageLoading';

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * Recursos do plano do posto (spec 0003). Até a assinatura pelo Mercado Pago
 * existir, a equipe libera aqui; cada mudança fica registrada.
 */
export function StationFeaturesSection({
  stationId,
  onNotice,
}: {
  stationId: string;
  onNotice: (message: string) => void;
}) {
  const features = useStationFeatures(stationId);
  const set = useSetStationFeature(stationId);
  const [note, setNote] = useState('');
  const active = features.data?.features.filter((f) => f.active) ?? [];

  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
        <div>
          <Typography sx={{ fontWeight: 700 }}>Recursos do plano</Typography>
          {features.data && (
            <Typography variant="body2" color="text.secondary">
              {active.length > 0
                ? active.map((f) => STATION_FEATURE_LABELS[f.feature]).join(', ')
                : 'Nenhum recurso liberado'}
            </Typography>
          )}
        </div>
      </AccordionSummary>
      <AccordionDetails>
        {features.isPending ? (
          <PageLoading />
        ) : features.isError ? (
          <Alert severity="error">{features.error.message}</Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Enquanto a assinatura não existe, a equipe libera os recursos
              pagos aqui. Visitas no portal: o posto vê quantos motoristas
              olharam o posto no app.
            </Typography>
            <TextField
              size="small"
              label="Observação (opcional)"
              placeholder="Ex.: piloto, cortesia até março"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            {features.data.features.map((f) => (
              <div key={f.feature}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={f.active}
                      disabled={set.isPending}
                      onChange={(_, checked) =>
                        set.mutate(
                          {
                            feature: f.feature,
                            active: checked,
                            note: note || undefined,
                          },
                          {
                            onSuccess: () => {
                              setNote('');
                              onNotice(
                                `${STATION_FEATURE_LABELS[f.feature]}: ${checked ? 'liberado' : 'desligado'}.`,
                              );
                            },
                          },
                        )
                      }
                    />
                  }
                  label={STATION_FEATURE_LABELS[f.feature]}
                />
                {f.changedAt && (
                  <Typography variant="body2" color="text.secondary">
                    {f.active ? 'Liberado' : 'Desligado'} em{' '}
                    {dateTime.format(new Date(f.changedAt))}
                    {f.changedBy ? ` por ${f.changedBy}` : ''}
                    {f.note ? ` · ${f.note}` : ''}
                  </Typography>
                )}
              </div>
            ))}
            {set.error && (
              <Alert severity="error">
                {set.error instanceof ApiError
                  ? set.error.message
                  : 'Não foi possível salvar.'}
              </Alert>
            )}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
