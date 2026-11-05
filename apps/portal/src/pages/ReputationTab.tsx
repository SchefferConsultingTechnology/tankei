import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CONFIDENCE_LABELS } from '@tankei/shared';
import type { ReactNode } from 'react';
import { useReputation } from '../api/queries';

/** IQP do posto por dimensão comparado à média da cidade (ADR 0012). */
export function ReputationTab({ stationId }: { stationId: string }) {
  const reputation = useReputation(stationId);

  if (reputation.isPending) {
    return <Typography color="text.secondary">Carregando…</Typography>;
  }
  if (reputation.isError) {
    return <Alert severity="error">{reputation.error.message}</Alert>;
  }
  const { station, city } = reputation.data;
  const cityByDimension = new Map(
    city.dimensions.map((d) => [d.dimension, d.score]),
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
        Reputação (IQP)
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr 1fr',
            md: 'repeat(2, minmax(0, 320px))',
          },
        }}
      >
        <ScoreCard
          label="IQP do seu posto"
          score={station.score}
          detail={
            station.score == null
              ? `${station.reviewers} ${station.reviewers === 1 ? 'avaliação' : 'avaliações'} até agora`
              : `${station.reviewers} ${station.reviewers === 1 ? 'pessoa avaliou' : 'pessoas avaliaram'}`
          }
          extra={
            <Stack
              direction="row"
              spacing={0.5}
              useFlexGap
              sx={{ flexWrap: 'wrap' }}
            >
              {station.confidence && (
                <Chip
                  size="small"
                  label={CONFIDENCE_LABELS[station.confidence]}
                />
              )}
              {station.score != null && city.score != null && (
                <DiffChip diff={station.score - city.score} />
              )}
            </Stack>
          }
        />
        <ScoreCard
          label="Média da cidade"
          score={city.score}
          detail={
            city.stations === 0
              ? 'Nenhum posto da cidade tem nota ainda'
              : `${city.stations} ${city.stations === 1 ? 'posto com nota' : 'postos com nota'}`
          }
        />
      </Box>

      {station.score == null && (
        <Alert severity="info">
          Ainda não há avaliações suficientes para a nota do seu posto. Ela
          aparece quando mais consumidores avaliarem; as notas por dimensão
          também.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.5, sm: 2 }}
          sx={{ justifyContent: 'space-between', mb: 1 }}
        >
          <Typography sx={{ fontWeight: 700 }}>Por dimensão</Typography>
          <Stack direction="row" spacing={2}>
            <Legend color="primary.main" label="Seu posto" />
            <Legend color="text.disabled" label="Média da cidade" />
          </Stack>
        </Stack>

        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {station.dimensions.map((d) => {
            const cityScore = cityByDimension.get(d.dimension) ?? null;
            return (
              <Box key={d.dimension} sx={{ py: 1.5 }}>
                <Typography sx={{ fontWeight: 600 }}>{d.label}</Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', mt: 0.5, mb: 1 }}
                >
                  {d.score != null && cityScore != null && (
                    <DiffChip diff={d.score - cityScore} />
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    peso {d.weight}%
                  </Typography>
                </Stack>
                <ScoreBar label="Seu posto" score={d.score} />
                <ScoreBar label="Média da cidade" score={cityScore} city />
              </Box>
            );
          })}
        </Stack>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        O IQP é calculado pelo Tankei a partir das avaliações dos consumidores,
        com a metodologia {station.methodologyVersion}. Preço não entra na nota,
        e nenhum plano pago a altera.
      </Typography>
    </Stack>
  );
}

function ScoreCard({
  label,
  score,
  detail,
  extra,
}: {
  label: string;
  score: number | null;
  detail: string;
  extra?: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h4"
        component="p"
        sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', my: 0.5 }}
      >
        {score ?? '—'}
        {score != null && (
          <Typography component="span" variant="body2" color="text.secondary">
            {' '}
            /100
          </Typography>
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {detail}
      </Typography>
      {extra && <Box sx={{ mt: 1 }}>{extra}</Box>}
    </Paper>
  );
}

/** Diferença para a cidade, em pontos (descritiva). */
function DiffChip({ diff }: { diff: number }) {
  if (diff === 0)
    return <Chip size="small" label="Igual à cidade" variant="outlined" />;
  const above = diff > 0;
  return (
    <Chip
      size="small"
      variant="outlined"
      color={above ? 'success' : 'warning'}
      label={`${above ? '+' : '−'}${Math.abs(diff)} ${above ? 'acima' : 'abaixo'} da cidade`}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box
        sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }}
      />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

function ScoreBar({
  label,
  score,
  city = false,
}: {
  label: string;
  score: number | null;
  city?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.5 }}>
      <LinearProgress
        variant="determinate"
        value={score ?? 0}
        aria-label={`${label}: ${score ?? 'sem nota'}`}
        sx={{
          flex: 1,
          height: 10,
          borderRadius: 5,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 5,
            bgcolor: city ? 'text.disabled' : 'primary.main',
          },
        }}
      />
      <Typography
        variant="body2"
        sx={{
          width: 32,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: city ? 400 : 700,
          color: city ? 'text.secondary' : 'text.primary',
        }}
      >
        {score ?? '—'}
      </Typography>
    </Stack>
  );
}
