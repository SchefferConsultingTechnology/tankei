import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { StationPhoto } from '@tankei/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useAddPhoto, useRemovePhoto, useStationPhotos } from '../api/queries';
import { useCan, useStationContext } from './station-context';

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir. Tente de novo.';
}

/** Fotos do posto na ficha do app (ADR 0026). */
export function PhotosPage() {
  const { station } = useStationContext();
  const canManage = useCan('manage_promotions');
  const photos = useStationPhotos(station.id);
  const [choosing, setChoosing] = useState(false);
  const [removing, setRemoving] = useState<StationPhoto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = photos.data;
  const full = data ? data.photos.length >= data.maxPhotos : false;

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            Fotos do posto
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aparecem na ficha do posto no app.
            {data && ` ${data.photos.length} de ${data.maxPhotos}.`}
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddPhotoAlternateOutlined />}
            onClick={() => setChoosing(true)}
            disabled={!data || full}
            sx={{ flexShrink: 0 }}
          >
            Enviar
          </Button>
        )}
      </Stack>

      {data?.removedByTankei.map((r) => (
        <Alert key={r.id} severity="warning">
          A equipe Tankei removeu {r.caption ? `a foto “${r.caption}”` : 'uma foto'}:{' '}
          {r.reason}
        </Alert>
      ))}
      {canManage && full && (
        <Alert severity="info">
          Limite de {data?.maxPhotos} fotos. Remova uma para enviar outra.
        </Alert>
      )}
      {photos.isPending && (
        <Typography color="text.secondary">Carregando…</Typography>
      )}
      {photos.isError && <Alert severity="error">{photos.error.message}</Alert>}
      {data?.photos.length === 0 && (
        <Alert severity="info">
          Nenhuma foto ainda. Boas opções: fachada, pista, loja de conveniência e
          banheiro. Evite pessoas e placas de carros.
        </Alert>
      )}

      {data && data.photos.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          {data.photos.map((photo) => (
            <Paper
              key={photo.id}
              variant="outlined"
              sx={{ overflow: 'hidden', position: 'relative' }}
            >
              <Box
                component="img"
                src={photo.url}
                alt={photo.caption ?? 'Foto do posto'}
                loading="lazy"
                sx={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <Stack
                direction="row"
                sx={{ alignItems: 'center', px: 1, py: 0.5, minHeight: 40 }}
              >
                <Typography
                  variant="body2"
                  color={photo.caption ? 'text.primary' : 'text.secondary'}
                  noWrap
                  sx={{ flex: 1 }}
                >
                  {photo.caption ?? 'Sem legenda'}
                </Typography>
                {canManage && (
                  <Tooltip title="Remover">
                    <IconButton
                      size="small"
                      aria-label={`Remover ${photo.caption ?? 'foto'}`}
                      onClick={() => setRemoving(photo)}
                    >
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Paper>
          ))}
        </Box>
      )}

      {choosing && data && (
        <UploadDialog
          stationId={station.id}
          maxMb={data.maxUploadMb}
          onClose={() => setChoosing(false)}
          onDone={() => {
            setChoosing(false);
            setNotice('Foto publicada.');
          }}
        />
      )}
      {removing && (
        <RemoveDialog
          stationId={station.id}
          photo={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            setNotice('Foto removida.');
          }}
        />
      )}

      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
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

function UploadDialog({
  stationId,
  maxMb,
  onClose,
  onDone,
}: {
  stationId: string;
  maxMb: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const add = useAddPhoto(stationId);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const tooBig = file !== null && file.size > maxMb * 1024 * 1024;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || tooBig) return;
    add.mutate({ file, caption }, { onSuccess: onDone });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={mobile}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { component: 'form', onSubmit: submit } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Enviar foto</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Button
            component="label"
            variant="outlined"
            startIcon={<AddPhotoAlternateOutlined />}
          >
            {file ? 'Escolher outra' : 'Escolher foto'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Button>
          {preview && (
            <Box
              component="img"
              src={preview}
              alt="Prévia"
              sx={{
                width: '100%',
                maxHeight: 260,
                objectFit: 'contain',
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            />
          )}
          {tooBig && (
            <Alert severity="error">
              A foto tem mais de {maxMb} MB. Escolha uma menor.
            </Alert>
          )}
          <TextField
            label="Legenda (opcional)"
            placeholder="Fachada, loja de conveniência…"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
          <Typography variant="body2" color="text.secondary">
            Publicada na hora. A foto é reduzida e os dados de localização do
            arquivo são descartados. JPG, PNG ou WebP, até {maxMb} MB.
          </Typography>
          {errorText(add.error) && (
            <Alert severity="error">{errorText(add.error)}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!file || tooBig || add.isPending}
        >
          {add.isPending ? 'Enviando…' : 'Publicar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RemoveDialog({
  stationId,
  photo,
  onClose,
  onDone,
}: {
  stationId: string;
  photo: StationPhoto;
  onClose: () => void;
  onDone: () => void;
}) {
  const remove = useRemovePhoto(stationId);
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Remover foto?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {photo.caption ? `“${photo.caption}” sai` : 'A foto sai'} da ficha do
          posto no app.
        </DialogContentText>
        {errorText(remove.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(remove.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Voltar</Button>
        <Button
          variant="contained"
          color="error"
          disabled={remove.isPending}
          onClick={() => remove.mutate(photo.id, { onSuccess: onDone })}
        >
          Remover
        </Button>
      </DialogActions>
    </Dialog>
  );
}
