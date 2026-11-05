import MailOutline from '@mui/icons-material/MailOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ORG_ROLE_DESCRIPTIONS, ORG_ROLE_LABELS } from '@tankei/shared';
import { ApiError } from '../api/client';
import { useAnswerInvitation, useMyInvitations } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';

/** Convites pendentes para o e-mail da conta, para aceitar ou recusar. */
export function InvitationsBanner() {
  const invitations = useMyInvitations();
  const answer = useAnswerInvitation();
  const { refreshUser } = useAuth();

  if (!invitations.data || invitations.data.length === 0) return null;

  return (
    <Stack spacing={1.5}>
      {invitations.data.map((inv) => (
        <Paper
          key={inv.id}
          variant="outlined"
          sx={{ p: 2, borderLeft: 4, borderLeftColor: 'secondary.main' }}
        >
          <Stack direction="row" spacing={1.5}>
            <MailOutline color="secondary" sx={{ mt: 0.25 }} />
            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>
                Convite para a equipe de {inv.organization.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {inv.invitedBy
                  ? `${inv.invitedBy} convidou você`
                  : 'Você foi convidado'}{' '}
                como <strong>{ORG_ROLE_LABELS[inv.role]}</strong>:{' '}
                {ORG_ROLE_DESCRIPTIONS[inv.role].toLowerCase()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {inv.stations.length === 1 ? 'Unidade' : 'Unidades'}:{' '}
                {inv.stations.map((s) => s.name).join(', ')}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: 'flex-end', pt: 1 }}
              >
                <Button
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ id: inv.id, accept: false })}
                >
                  Recusar
                </Button>
                <Button
                  variant="contained"
                  disabled={answer.isPending}
                  onClick={() =>
                    answer.mutate(
                      { id: inv.id, accept: true },
                      { onSuccess: () => void refreshUser() },
                    )
                  }
                >
                  Aceitar
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      ))}
      {answer.error && (
        <Alert severity="error">
          {answer.error instanceof ApiError
            ? answer.error.message
            : 'Não foi possível responder ao convite.'}
        </Alert>
      )}
    </Stack>
  );
}
