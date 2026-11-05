import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { IQP_SCALE_MAX } from '@tankei/shared';

/**
 * Nota do IQP num arco de 0 a 100, com "de 100" embaixo: a escala fica
 * visível sem texto extra. Sem nota (dados insuficientes), arco vazio e "—".
 */
export function IqpGauge({
  score,
  size = 88,
  muted = false,
}: {
  score: number | null;
  size?: number;
  /** Cor neutra (ex.: média da cidade, para não competir com a do posto). */
  muted?: boolean;
}) {
  const label =
    score === null
      ? 'IQP sem nota: dados insuficientes'
      : `IQP ${score} de ${IQP_SCALE_MAX}`;

  return (
    <Box
      role="img"
      aria-label={label}
      sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      {/* Trilho completo (a escala inteira). */}
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={4}
        sx={{ color: 'action.hover', position: 'absolute', inset: 0 }}
        aria-hidden
      />
      <CircularProgress
        variant="determinate"
        value={score ?? 0}
        size={size}
        thickness={4}
        sx={{
          color: muted ? 'text.disabled' : 'primary.main',
          position: 'absolute',
          inset: 0,
          '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
        }}
        aria-hidden
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
        aria-hidden
      >
        <Typography
          component="span"
          sx={{
            fontWeight: 800,
            fontSize: size * 0.32,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {score ?? '—'}
        </Typography>
        <Typography
          component="span"
          color="text.secondary"
          sx={{ fontSize: Math.max(11, size * 0.13), lineHeight: 1.3 }}
        >
          de {IQP_SCALE_MAX}
        </Typography>
      </Box>
    </Box>
  );
}
