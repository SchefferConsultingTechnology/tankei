import LocalGasStationOutlined from '@mui/icons-material/LocalGasStationOutlined';
import NearMeOutlined from '@mui/icons-material/NearMeOutlined';
import StarBorderOutlined from '@mui/icons-material/StarBorderOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { GoogleButton } from '../auth/GoogleButton';
import { useTheme } from '../theme';

const BENEFITS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <LocalGasStationOutlined />,
    title: 'Preços em segundos',
    text: 'Atualize pelo celular, com o selo “Atualizado pelo posto” no app.',
  },
  {
    icon: <NearMeOutlined />,
    title: 'Concorrência da região',
    text: 'Seu preço perto dos postos próximos, da cidade e da média da ANP.',
  },
  {
    icon: <StarBorderOutlined />,
    title: 'Reputação',
    text: 'Como os consumidores avaliam o atendimento, por dimensão.',
  },
];

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
        maxWidth: 460,
        mx: 'auto',
        mt: { xs: 1, sm: '6vh' },
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
      <Stack spacing={3}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            component="img"
            src={
              scheme === 'dark'
                ? '/logo-horizontal-dark.png'
                : '/logo-horizontal.png'
            }
            alt="Tankei"
            sx={{ height: 44, display: 'inline-block' }}
          />
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 700, mt: 1.5 }}
          >
            Portal do posto
          </Typography>
        </Box>

        <Stack
          spacing={1.5}
          component="ul"
          sx={{ m: 0, p: 0, listStyle: 'none' }}
        >
          {BENEFITS.map((b) => (
            <Stack key={b.title} component="li" direction="row" spacing={1.5}>
              <Box sx={{ color: 'primary.main', pt: 0.25 }}>{b.icon}</Box>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{b.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {b.text}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>

        <Divider />

        <GoogleButton onCredential={(token) => void handle(token)} />
        {error && <Alert severity="error">{error}</Alert>}

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center' }}
        >
          O acesso é liberado para quem responde pelo posto. Depois de entrar,
          você pode pedir acesso ao seu posto.
        </Typography>
      </Stack>
    </Paper>
  );
}
