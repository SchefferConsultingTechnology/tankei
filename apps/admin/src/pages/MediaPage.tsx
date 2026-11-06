import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { AdminMedia } from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { useMedia, useRemoveMedia } from '../api/admin-queries';
import { errorText, formatDateTime, useMobile } from '../components/hooks';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';

const PERIODS = [7, 30, 90];

/** Fotos e artes publicadas pelos postos, com remoção (ADR 0026). */
export function MediaPage() {
  const [days, setDays] = useState(7);
  const media = useMedia(days);
  const [removing, setRemoving] = useState<AdminMedia | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Imagens"
        subtitle="Fotos e artes de promoção são publicadas na hora. Confira as novas e remova o que não deve ficar no app (pessoas, placas, conteúdo impróprio ou de terceiros)."
        actions={
          <TextField
            select
            size="small"
            label="Período"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p} value={p}>
                {p} dias
              </MenuItem>
            ))}
          </TextField>
        }
      />

      {media.isPending && <PageLoading />}
      {media.isError && <Alert severity="error">{media.error.message}</Alert>}
      {media.data?.length === 0 && (
        <Alert severity="info">Nenhuma imagem enviada no período.</Alert>
      )}

      {media.data && media.data.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {media.data.map((item) => (
            <Paper
              key={`${item.kind}-${item.id}`}
              variant="outlined"
              sx={{ overflow: 'hidden', opacity: item.removed ? 0.6 : 1 }}
            >
              {item.removed ? (
                <Box
                  sx={{
                    aspectRatio: '4 / 3',
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Removida
                  </Typography>
                </Box>
              ) : (
                <Box
                  component="a"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ display: 'block' }}
                >
                  <Box
                    component="img"
                    src={item.url}
                    alt={item.label ?? 'Imagem do posto'}
                    loading="lazy"
                    sx={{
                      width: '100%',
                      aspectRatio: '4 / 3',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </Box>
              )}
              <Stack spacing={0.75} sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={item.kind === 'foto' ? 'Foto' : 'Arte de promoção'}
                  />
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {item.label ?? 'Sem legenda'}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  <Link
                    component={RouterLink}
                    to={`/postos/${item.station.id}`}
                    underline="hover"
                  >
                    {item.station.name}
                  </Link>{' '}
                  · {item.station.city}/{item.station.state}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(item.createdAt)}
                  {item.uploadedBy ? ` · ${item.uploadedBy}` : ''}
                </Typography>
                {item.removed ? (
                  <Alert severity="info" sx={{ py: 0 }}>
                    Removida por {item.removed.by ?? 'alguém'} em{' '}
                    {formatDateTime(item.removed.at)}: {item.removed.reason}
                  </Alert>
                ) : (
                  <Box>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlined />}
                      onClick={() => setRemoving(item)}
                      sx={{ ml: -0.5 }}
                    >
                      Remover
                    </Button>
                  </Box>
                )}
              </Stack>
            </Paper>
          ))}
        </Box>
      )}

      {removing && (
        <RemoveDialog
          item={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setNotice(
              removing.kind === 'foto'
                ? 'Foto removida do app.'
                : 'Arte removida; a promoção continua.',
            );
            setRemoving(null);
          }}
        />
      )}
      <Notice message={notice} onClose={() => setNotice(null)} />
    </Stack>
  );
}

function RemoveDialog({
  item,
  onClose,
  onDone,
}: {
  item: AdminMedia;
  onClose: () => void;
  onDone: () => void;
}) {
  const remove = useRemoveMedia();
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5 && !remove.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    remove.mutate(
      { kind: item.kind, id: item.id, reason: reason.trim() },
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
        {item.kind === 'foto' ? 'Remover foto' : 'Remover arte'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {item.kind === 'foto'
            ? `A foto sai da ficha de ${item.station.name} no app.`
            : `A arte sai da promoção “${item.label ?? ''}”; a promoção continua.`}
        </DialogContentText>
        <TextField
          label="Motivo"
          helperText="O posto vê este motivo no portal."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={2}
          fullWidth
          autoFocus
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        {errorText(remove.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(remove.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained" color="error" disabled={!valid}>
          Remover
        </Button>
      </DialogActions>
    </Dialog>
  );
}
