import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../api/client';
import { useStationInfo, useUpdateStationInfo } from '../api/queries';
import { PageLoading } from '../components/PageLoading';
import { StationInfoEditor } from '../components/StationInfoEditor';
import { useCan, useStationContext } from './station-context';

/** Horário de atendimento e serviços do posto (ADR 0033). */
export function StationInfoPage() {
  const { station } = useStationContext();
  const canEdit = useCan('manage_info');
  const info = useStationInfo(station.id);
  const update = useUpdateStationInfo(station.id);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          Dados do posto
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Nome, horário e serviços aparecem no app, no cartão do posto no mapa
          e na ficha.
          {!canEdit && ' Só o proprietário e o gestor alteram.'}
        </Typography>
      </div>
      {info.isPending ? (
        <PageLoading />
      ) : info.isError ? (
        <Alert severity="error">{info.error.message}</Alert>
      ) : (
        <StationInfoEditor
          // Remonta ao salvar, com os dados que voltaram da API.
          key={info.data.updatedAt ?? 'novo'}
          info={info.data}
          state={station.state}
          canEdit={canEdit}
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
              onSuccess: () => {
                setSaved(true);
                // O nome novo aparece no cabeçalho e na lista de unidades.
                void queryClient.invalidateQueries({
                  queryKey: ['stations', station.id],
                });
                void refreshUser().catch(() => undefined);
              },
            })
          }
        />
      )}
      <Snackbar
        open={saved}
        autoHideDuration={4000}
        onClose={() => setSaved(false)}
        message="Dados do posto salvos. Já aparecem no app."
      />
    </Stack>
  );
}
