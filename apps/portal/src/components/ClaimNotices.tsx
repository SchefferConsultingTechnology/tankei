import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import {
  CLAIM_POSITION_LABELS,
  type StationClaimNotice,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useDisputeClaim, useStationClaims } from '../api/queries';

/**
 * Pedidos de acesso ao posto feitos por outras pessoas, para o proprietário
 * (ADR 0011 e 0027): quem não reconhece avisa a equipe Tankei antes da
 * decisão.
 */
export function ClaimNotices({ stationId }: { stationId: string }) {
  const claims = useStationClaims(stationId);
  const [disputing, setDisputing] = useState<StationClaimNotice | null>(null);
  if (!claims.data || claims.data.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ my: 2 }}>
      {claims.data.map((c) => (
        <Alert
          key={c.id}
          severity={c.disputedByMe ? 'info' : 'warning'}
          action={
            c.disputedByMe ? undefined : (
              <Button color="inherit" size="small" onClick={() => setDisputing(c)}>
                Não reconheço
              </Button>
            )
          }
        >
          {c.contactName ?? 'Uma pessoa'} ({CLAIM_POSITION_LABELS[c.position]})
          pediu acesso a este posto em{' '}
          {new Date(c.createdAt).toLocaleDateString('pt-BR')}.{' '}
          {c.disputedByMe
            ? 'Você avisou que não reconhece; a equipe Tankei vai analisar.'
            : 'A equipe Tankei confirma o vínculo antes de liberar.'}
        </Alert>
      ))}
      {disputing && (
        <DisputeDialog
          stationId={stationId}
          claim={disputing}
          onClose={() => setDisputing(null)}
        />
      )}
    </Stack>
  );
}

function DisputeDialog({
  stationId,
  claim,
  onClose,
}: {
  stationId: string;
  claim: StationClaimNotice;
  onClose: () => void;
}) {
  const dispute = useDisputeClaim(stationId);
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5 && !dispute.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    dispute.mutate(
      { claimId: claim.id, reason: reason.trim() },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { component: 'form', onSubmit: submit } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Não reconheço este pedido</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          A equipe Tankei recebe o seu aviso e confere antes de decidir o pedido
          de {claim.contactName ?? 'acesso'}.
        </DialogContentText>
        <TextField
          label="Por que você não reconhece?"
          placeholder="Ex.: essa pessoa não trabalha no posto."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={2}
          fullWidth
          autoFocus
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        {dispute.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {dispute.error instanceof ApiError
              ? dispute.error.message
              : 'Não foi possível enviar. Tente de novo.'}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!valid}>
          Avisar a equipe Tankei
        </Button>
      </DialogActions>
    </Dialog>
  );
}
