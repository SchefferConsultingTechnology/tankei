import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { GoogleButton } from '../auth/GoogleButton';
import { useTheme } from '../theme';

export function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const { scheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(idToken: string) {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle(idToken);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível entrar. Tente de novo.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        width: '100%',
        maxWidth: 420,
        mx: 'auto',
        mt: { xs: 1, sm: '8vh' },
        p: { xs: 2.5, sm: 4 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {busy && (
        <LinearProgress
          aria-label="Entrando"
          sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        />
      )}
      <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <Box
          component="img"
          src={
            scheme === 'dark'
              ? '/logo-horizontal-dark.png'
              : '/logo-horizontal.png'
          }
          alt="Tankei"
          sx={{ height: 44 }}
        />
        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
          <AdminPanelSettingsOutlined color="primary" />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Administração
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Área da equipe Tankei: pedidos de acesso dos postos e moderação.
          </Typography>
        </Stack>
        <GoogleButton onCredential={(token) => void handle(token)} />
        {error && <Alert severity="error">{error}</Alert>}
        <Typography variant="body2" color="text.secondary">
          Só contas de administrador entram aqui.
        </Typography>
      </Stack>
    </Paper>
  );
}
