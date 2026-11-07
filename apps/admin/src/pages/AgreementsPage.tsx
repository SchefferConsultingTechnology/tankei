import AddOutlined from '@mui/icons-material/AddOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { AdminAgreement } from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import {
  useAgreements,
  useCreateAgreement,
  useRemoveAgreement,
  useUpdateAgreement,
} from '../api/admin-queries';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';

const errorText = (error: unknown) =>
  error
    ? error instanceof ApiError
      ? error.message
      : 'Não foi possível concluir. Tente de novo.'
    : null;

/**
 * Cadastro de convênios (ADR 0034). O portal cria; aqui a equipe renomeia,
 * descreve e desativa. Excluir só quem nunca foi usado por um posto.
 */
export function AgreementsPage() {
  const agreements = useAgreements();
  const [editing, setEditing] = useState<AdminAgreement | 'novo' | null>(null);
  const [removing, setRemoving] = useState<AdminAgreement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const remove = useRemoveAgreement();

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Convênios"
        subtitle="Cadastro único: os postos escolhem daqui e informam o próprio desconto no portal."
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setEditing('novo')}
          >
            Novo convênio
          </Button>
        }
      />
      {agreements.isPending ? (
        <PageLoading />
      ) : agreements.isError ? (
        <Alert severity="error">{agreements.error.message}</Alert>
      ) : agreements.data.length === 0 ? (
        <Typography color="text.secondary">Nenhum convênio cadastrado.</Typography>
      ) : (
        agreements.data.map((a) => (
          <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ justifyContent: 'space-between' }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700 }}>{a.name}</Typography>
                  {!a.active && <Chip size="small" label="Desativado" />}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={a.createdFrom === 'portal' ? 'Criado no portal' : 'Criado no admin'}
                  />
                </Stack>
                {a.description && (
                  <Typography variant="body2" color="text.secondary">
                    {a.description}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  {a.stationsUsing === 0
                    ? 'Nenhum posto com desconto agora'
                    : a.stationsUsing === 1
                      ? '1 posto com desconto agora'
                      : `${a.stationsUsing} postos com desconto agora`}
                  {a.everUsed && a.stationsUsing === 0 && ' (já usado antes)'}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <Button onClick={() => setEditing(a)}>Editar</Button>
                {!a.everUsed && (
                  <Button color="error" onClick={() => setRemoving(a)}>
                    Excluir
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>
        ))
      )}

      {editing && (
        <AgreementDialog
          current={editing === 'novo' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      )}

      <Dialog open={removing !== null} onClose={() => setRemoving(null)}>
        <DialogTitle>Excluir o convênio?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {removing?.name} nunca foi usado por um posto e sai do cadastro.
          </DialogContentText>
          {remove.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(remove.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)}>Cancelar</Button>
          <Button
            color="error"
            disabled={remove.isPending}
            onClick={() =>
              removing &&
              remove.mutate(removing.id, {
                onSuccess: () => {
                  setNotice(`Convênio ${removing.name} excluído.`);
                  setRemoving(null);
                },
              })
            }
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
      <Notice message={notice} onClose={() => setNotice(null)} />
    </Stack>
  );
}

function AgreementDialog({
  current,
  onClose,
  onSaved,
}: {
  current: AdminAgreement | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const create = useCreateAgreement();
  const update = useUpdateAgreement();
  const [name, setName] = useState(current?.name ?? '');
  const [description, setDescription] = useState(current?.description ?? '');
  const [active, setActive] = useState(current?.active ?? true);
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const valid = name.trim().length >= 2;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    if (current) {
      update.mutate(
        {
          id: current.id,
          body: {
            name: name.trim(),
            description: description.trim() || null,
            active,
          },
        },
        { onSuccess: () => onSaved(`Convênio ${name.trim()} salvo.`) },
      );
    } else {
      create.mutate(
        { name: name.trim(), description: description.trim() || undefined },
        { onSuccess: () => onSaved(`Convênio ${name.trim()} criado.`) },
      );
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>{current ? 'Editar convênio' : 'Novo convênio'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            <TextField
              label="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            {current && (
              <FormControlLabel
                control={
                  <Switch
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                }
                label="Ativo (desativado some do app e da busca do portal)"
              />
            )}
            {error && <Alert severity="error">{errorText(error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={!valid || pending}>
            Salvar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
