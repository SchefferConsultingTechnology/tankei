import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import {
  describeDay,
  STATION_SERVICE_LABELS,
  type StationInfo,
} from '@tankei/shared';
import { ApiError } from '../api/client';
import {
  useAdminStationInfo,
  useUpdateAdminStationInfo,
} from '../api/admin-queries';
import { PageLoading } from './PageLoading';
import { StationInfoEditor } from './StationInfoEditor';

function summary(info: StationInfo): string {
  const parts = [
    info.hours
      ? `Seg–sex ${describeDay(info.hours.dias_uteis)}`
      : 'Horário não informado',
    info.services.length > 0
      ? info.services.map((s) => STATION_SERVICE_LABELS[s]).join(', ')
      : 'Sem serviços marcados',
  ];
  if (info.updatedBy) {
    parts.push(info.updatedBy === 'posto' ? 'pelo posto' : 'pela equipe');
  }
  return parts.join(' · ');
}

/**
 * Horário e serviços pela equipe Tankei (ADR 0033): para postos do piloto
 * ainda sem responsável no portal.
 */
export function StationInfoSection({
  stationId,
  state,
  onNotice,
}: {
  stationId: string;
  state: string;
  onNotice: (message: string) => void;
}) {
  const info = useAdminStationInfo(stationId);
  const update = useUpdateAdminStationInfo(stationId);

  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
        <div>
          <Typography sx={{ fontWeight: 700 }}>Horário e serviços</Typography>
          {info.data && (
            <Typography variant="body2" color="text.secondary">
              {summary(info.data)}
            </Typography>
          )}
        </div>
      </AccordionSummary>
      <AccordionDetails>
        {info.isPending ? (
          <PageLoading />
        ) : info.isError ? (
          <Alert severity="error">{info.error.message}</Alert>
        ) : (
          <StationInfoEditor
            key={info.data.updatedAt ?? 'novo'}
            info={info.data}
            state={state}
            canEdit
            saving={update.isPending}
            error={
              update.error
                ? update.error instanceof ApiError
                  ? update.error.message
                  : 'Não foi possível salvar. Tente de novo.'
                : null
            }
            onSave={(body) =>
              update.mutate(body, {
                onSuccess: () => onNotice('Horário e serviços salvos.'),
              })
            }
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
}
