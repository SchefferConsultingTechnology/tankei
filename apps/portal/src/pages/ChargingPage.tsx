import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '../api/client';
import { useCharging, useSetCharging } from '../api/queries';
import { ChargersEditor } from '../components/ChargersEditor';
import { PageLoading } from '../components/PageLoading';
import { useCan, useStationContext } from './station-context';

/** Pontos de recarga elétrica do posto (ADR 0041). */
export function ChargingPage() {
  const { station } = useStationContext();
  const canEdit = useCan('manage_info');
  const charging = useCharging(station.id);
  const save = useSetCharging(station.id);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          Recarga elétrica
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Os pontos aparecem no app, na ficha do posto e para quem procura
          recarga. O preço por kWh você informa em Preços atuais, como um
          combustível (Recarga AC ou DC).
          {!canEdit && ' Só o proprietário e o gestor alteram.'}
        </Typography>
      </div>
      {charging.isPending ? (
        <PageLoading />
      ) : charging.isError ? (
        <Alert severity="error">{charging.error.message}</Alert>
      ) : (
        <ChargersEditor
          key={charging.data.official?.updatedAt ?? 'novo'}
          data={charging.data}
          canEdit={canEdit}
          saving={save.isPending}
          error={
            save.error
              ? save.error instanceof ApiError
                ? save.error.message
                : 'Não foi possível salvar. Tente de novo.'
              : null
          }
          onSave={(body) =>
            save.mutate(body, {
              onSuccess: () => {
                setSaved(true);
                // Recarga AC/DC entra ou sai dos combustíveis do posto.
                void queryClient.invalidateQueries({
                  queryKey: ['stations', station.id],
                });
              },
            })
          }
        />
      )}
      <Snackbar
        open={saved}
        autoHideDuration={4000}
        onClose={() => setSaved(false)}
        message="Recarga salva. Já aparece no app."
      />
    </Stack>
  );
}
