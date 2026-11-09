import LockOutlined from '@mui/icons-material/LockOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import {
  VISIT_ACTION_LABELS,
  VISIT_SOURCE_LABELS,
  type StationVisits,
} from '@tankei/shared';
import { useState } from 'react';
import { useStationFeatures, useStationVisits } from '../api/queries';
import {
  ChartCard,
  HorizontalBars,
  SimpleTable,
  StatTile,
} from '../components/dashboard-kit';
import {
  bucketLabel,
  GRANULARITY_LABEL,
  lastDays,
  number,
  PERIODS,
  SERIES,
} from '../components/dashboard-utils';
import { PageLoading } from '../components/PageLoading';
import { useStationContext } from './station-context';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Visitas dos motoristas ao posto no app (spec 0003): toques no cartão,
 * fichas abertas, tempo na ficha e o que virou informe ou avaliação. Só
 * totais, e contagens pequenas aparecem como "menos de N".
 */
export function VisitsPage() {
  const { station } = useStationContext();
  const [days, setDays] = useState<number>(30);
  const range = lastDays(days);
  const features = useStationFeatures(station.id);
  const unlocked =
    features.data?.features.find((f) => f.feature === 'visitas')?.active ??
    false;
  const visits = useStationVisits(station.id, range, unlocked);

  return (
    <Stack spacing={2.5}>
      <div>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          Visitas ao posto
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Motoristas que tocaram no seu posto no app Tankei. É anônimo: você
          vê só totais, nunca quem visitou.
        </Typography>
      </div>

      {features.isPending ? (
        <PageLoading />
      ) : features.isError ? (
        <Alert severity="error">{features.error.message}</Alert>
      ) : !unlocked ? (
        <Locked />
      ) : (
        <>
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={days}
            onChange={(_, value: number | null) => {
              if (value) setDays(value);
            }}
            aria-label="Período"
            sx={{ alignSelf: 'flex-start' }}
          >
            {PERIODS.map((p) => (
              <ToggleButton key={p.value} value={p.value}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {visits.isFetching && visits.data && <LinearProgress />}
          {visits.isPending ? (
            <PageLoading />
          ) : visits.isError ? (
            <Alert severity="error">{visits.error.message}</Alert>
          ) : (
            <VisitsContent data={visits.data} />
          )}
        </>
      )}
    </Stack>
  );
}

function Locked() {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <LockOutlined color="action" />
        <div>
          <Typography sx={{ fontWeight: 700 }}>
            Disponível na assinatura do portal
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Veja quantos motoristas olham o seu posto no app, quanto tempo
            ficam na ficha, de onde vêm e em que dias e horários. Fale com a
            equipe Tankei para liberar.
          </Typography>
        </div>
      </Stack>
    </Paper>
  );
}

function VisitsContent({ data }: { data: StationVisits }) {
  const theme = useTheme();
  const color = SERIES[theme.palette.mode];
  const { kpis, period, minBucket } = data;
  const few = `menos de ${minBucket}`;
  const show = (n: number | null) => (n === null ? `< ${minBucket}` : number(n));
  const delta = (a: number | null, b: number | null) =>
    a === null || b === null ? undefined : a - b;
  const rate = (n: number | null) =>
    n === null || !kpis.visits
      ? few
      : `${((n / kpis.visits) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das visitas`;
  const labels = data.series.map((p) => bucketLabel(p.start, period.granularity));
  const duration = (s: number) =>
    s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  /** Barras: abaixo do mínimo, sem barra e o texto "menos de N". */
  const bar = (label: string, value: number | null) => ({
    label,
    value: value ?? 0,
    display: value === null ? few : number(value),
  });

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            xl: 'repeat(6, minmax(0, 1fr))',
          },
        }}
      >
        <StatTile
          label="Visitas"
          value={show(kpis.visits)}
          delta={delta(kpis.visits, kpis.previous.visits)}
          hint="toques no posto no app"
        />
        <StatTile
          label="Motoristas"
          value={show(kpis.visitors)}
          delta={delta(kpis.visitors, kpis.previous.visitors)}
          hint="aparelhos diferentes"
        />
        <StatTile
          label="Abriram a ficha"
          value={show(kpis.detailVisits)}
          delta={delta(kpis.detailVisits, kpis.previous.detailVisits)}
          hint={rate(kpis.detailVisits)}
        />
        <StatTile
          label="Tempo na ficha"
          value={
            kpis.medianDetailSeconds === null
              ? '—'
              : duration(kpis.medianDetailSeconds)
          }
          hint="tempo típico (mediana)"
        />
        <StatTile
          label="Informaram preço"
          value={show(kpis.priceReports)}
          delta={delta(kpis.priceReports, kpis.previous.priceReports)}
          hint={rate(kpis.priceReports)}
        />
        <StatTile
          label="Avaliaram"
          value={show(kpis.reviews)}
          delta={delta(kpis.reviews, kpis.previous.reviews)}
          hint={rate(kpis.reviews)}
        />
      </Box>

      <ChartCard
        title={`Visitas ${GRANULARITY_LABEL[period.granularity]}`}
        subtitle={`Períodos com ${few} visitas ficam sem barra.`}
        table={
          <SimpleTable
            head={['Início', 'Visitas', 'Abriram a ficha']}
            rows={data.series.map((p, i) => [
              labels[i],
              show(p.visits),
              show(p.detailVisits),
            ])}
          />
        }
      >
        <BarChart
          height={260}
          xAxis={[{ scaleType: 'band', data: labels, categoryGapRatio: 0.45 }]}
          yAxis={[{ tickMinStep: 1, width: 40 }]}
          series={[
            {
              data: data.series.map((p) => p.visits),
              label: 'Visitas',
              color,
              valueFormatter: (v) => (v === null ? few : number(v)),
            },
          ]}
          borderRadius={4}
          grid={{ horizontal: true }}
          hideLegend
          margin={{ left: 0, right: 8 }}
        />
      </ChartCard>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '1fr 1fr' },
        }}
      >
        <ChartCard
          title="Do toque à contribuição"
          subtitle="Quantas visitas abriram a ficha e quantas viraram informe de preço ou avaliação. O resto olhou e seguiu."
        >
          <HorizontalBars
            color={color}
            rows={[
              bar('Tocaram no posto', kpis.visits),
              bar('Abriram a ficha', kpis.detailVisits),
              bar('Informaram preço', kpis.priceReports),
              bar('Avaliaram', kpis.reviews),
            ]}
          />
        </ChartCard>

        <ChartCard
          title="De onde vieram"
          subtitle="Onde o motorista tocou no seu posto."
        >
          <HorizontalBars
            color={color}
            rows={[...data.bySource]
              .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
              .map((s) => bar(VISIT_SOURCE_LABELS[s.source], s.visits))}
          />
        </ChartCard>

        <ChartCard
          title="Quando olham o posto"
          subtitle="Visitas por dia da semana e por faixa de horário (Brasília)."
          table={
            <SimpleTable
              head={['Quando', 'Visitas']}
              rows={[
                ...data.byWeekday.map((d) => [
                  WEEKDAYS[d.weekday],
                  show(d.visits),
                ]),
                ...data.byHour.map((h) => [
                  `${h.hour}h às ${h.hour + 3}h`,
                  show(h.visits),
                ]),
              ]}
            />
          }
        >
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '1fr 1fr' },
            }}
          >
            <SmallBars
              title="Dia da semana"
              labels={data.byWeekday.map((d) => WEEKDAYS[d.weekday])}
              values={data.byWeekday.map((d) => d.visits)}
              color={color}
              few={few}
            />
            <SmallBars
              title="Horário"
              labels={data.byHour.map((h) => `${h.hour}h`)}
              values={data.byHour.map((h) => h.visits)}
              color={color}
              few={few}
            />
          </Box>
        </ChartCard>

        <ChartCard
          title="O que fizeram na visita"
          subtitle="Ações a partir da ficha do posto."
        >
          <HorizontalBars
            color={color}
            rows={data.actions
              // Só as ações que o app já oferece.
              .filter((a) => a.action === 'route' || a.visits !== null)
              .map((a) => bar(VISIT_ACTION_LABELS[a.action], a.visits))}
          />
        </ChartCard>
      </Box>
    </Stack>
  );
}

/** Barras verticais pequenas, uma cor; abaixo do mínimo, sem barra. */
function SmallBars({
  title,
  labels,
  values,
  color,
  few,
}: {
  title: string;
  labels: string[];
  values: (number | null)[];
  color: string;
  few: string;
}) {
  return (
    <div>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <BarChart
        height={180}
        xAxis={[{ scaleType: 'band', data: labels, categoryGapRatio: 0.4 }]}
        yAxis={[{ tickMinStep: 1, width: 36 }]}
        series={[
          {
            data: values,
            label: 'Visitas',
            color,
            valueFormatter: (v) => (v === null ? few : number(v)),
          },
        ]}
        borderRadius={4}
        grid={{ horizontal: true }}
        hideLegend
        margin={{ left: 0, right: 4 }}
      />
    </div>
  );
}
