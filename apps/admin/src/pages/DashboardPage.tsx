import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import type { AdhesionDashboard, ClaimOrigin } from '@tankei/shared';
import { useAdhesionDashboard } from '../api/admin-queries';
import {
  ChartCard,
  DashboardFilters,
  HorizontalBars,
  SimpleTable,
  StatTile,
} from '../components/dashboard-kit';
import {
  bucketLabel,
  GRANULARITY_LABEL,
  number,
  SERIES,
  useDashboardFilters,
} from '../components/dashboard-utils';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';

/** Rótulos curtos da origem do pedido (cabem ao lado da barra). */
const ORIGIN_SHORT: Record<ClaimOrigin, string> = {
  portal: 'Portal',
  app_dono: 'App (responsável)',
  app_convite: 'App (convite)',
};

/**
 * Dashboard de adesão (ADR 0037): postos que entraram no portal por período
 * e região, pedidos de acesso, funil e origem.
 */
export function DashboardPage() {
  const filters = useDashboardFilters();
  const dashboard = useAdhesionDashboard(filters.query);
  const data = dashboard.data;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Adesão de postos"
        subtitle="Postos que entraram no portal (pedido aprovado ou vínculo feito pela equipe)."
      />
      <DashboardFilters filters={filters} />
      {dashboard.isFetching && data && <LinearProgress />}

      {dashboard.isPending ? (
        <PageLoading />
      ) : dashboard.isError ? (
        <Alert severity="error">{dashboard.error.message}</Alert>
      ) : (
        <DashboardContent data={data!} />
      )}
    </Stack>
  );
}

function DashboardContent({ data }: { data: AdhesionDashboard }) {
  const theme = useTheme();
  const color = SERIES[theme.palette.mode];
  const { kpis, period } = data;
  const delta = kpis.adheredInPeriod - kpis.adheredPreviousPeriod;
  const share =
    kpis.stationsInScope > 0
      ? (kpis.adheredTotal / kpis.stationsInScope) * 100
      : 0;
  const labels = data.series.map((p) => bucketLabel(p.start, period.granularity));

  return (
    <Stack spacing={2.5}>
      {/* Indicadores. */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(5, minmax(0, 1fr))',
          },
        }}
      >
        <StatTile
          label="Postos aderidos"
          value={number(kpis.adheredTotal)}
          hint={`${share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% dos ${number(kpis.stationsInScope)} postos da ANP`}
        />
        <StatTile
          label="Aderidos no período"
          value={number(kpis.adheredInPeriod)}
          delta={delta}
          hint="vs período anterior"
        />
        <StatTile
          label="Pedidos em análise"
          value={number(kpis.pendingClaims)}
          hint={`${number(kpis.approvedInPeriod)} aprovados e ${number(kpis.rejectedInPeriod)} recusados no período`}
        />
        <StatTile
          label="Tempo até aprovar"
          value={
            kpis.avgApprovalHours === null
              ? '—'
              : kpis.avgApprovalHours < 48
                ? `${Math.round(kpis.avgApprovalHours)} h`
                : `${(kpis.avgApprovalHours / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
          }
          hint="média no período"
        />
        <StatTile
          label="Atualizando preço"
          value={number(kpis.updatingPrices)}
          hint={`de ${number(kpis.adheredTotal)} aderidos, nos últimos 7 dias`}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '1fr 1fr' },
        }}
      >
        <ChartCard
          title={`Adesões ${GRANULARITY_LABEL[period.granularity]}`}
          table={
            <SimpleTable
              head={['Início', 'Aderidos', 'Acumulado']}
              rows={data.series.map((p, i) => [
                labels[i],
                number(p.adhered),
                number(p.cumulative),
              ])}
            />
          }
        >
          <BarChart
            height={260}
            xAxis={[{ scaleType: 'band', data: labels, categoryGapRatio: 0.45 }]}
            yAxis={[{ tickMinStep: 1, width: 40 }]}
            series={[
              { data: data.series.map((p) => p.adhered), label: 'Aderidos', color },
            ]}
            borderRadius={4}
            grid={{ horizontal: true }}
            hideLegend
            margin={{ left: 0, right: 8 }}
          />
        </ChartCard>

        <ChartCard title="Postos aderidos (acumulado)">
          <LineChart
            height={260}
            xAxis={[{ scaleType: 'point', data: labels }]}
            yAxis={[{ tickMinStep: 1, width: 40 }]}
            series={[
              {
                data: data.series.map((p) => p.cumulative),
                label: 'Acumulado',
                color,
                area: true,
                showMark: false,
              },
            ]}
            grid={{ horizontal: true }}
            hideLegend
            margin={{ left: 0, right: 8 }}
            sx={{
              // Área como um véu (10%), a linha é que carrega o dado.
              '& .MuiLineChart-area': { fillOpacity: 0.1 },
              '& .MuiLineChart-line': { strokeWidth: 2 },
            }}
          />
        </ChartCard>

        <ChartCard
          title="Funil do período"
          subtitle="Pedidos feitos no período, os aprovados e, desses postos, os que já informam preço pelo portal."
        >
          <HorizontalBars
            color={color}
            rows={[
              { label: 'Pedidos', value: data.funnel.requested },
              { label: 'Aprovados', value: data.funnel.approved },
              { label: 'Informam preço', value: data.funnel.updatingPrices },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Origem dos pedidos"
          subtitle="De onde vieram os pedidos de acesso do período (ADR 0031)."
        >
          <HorizontalBars
            color={color}
            rows={[...data.byOrigin]
              .sort((a, b) => b.claims - a.claims)
              .map((o) => ({
                label: ORIGIN_SHORT[o.origin],
                value: o.claims,
              }))}
          />
        </ChartCard>
      </Box>

      <ChartCard
        title="Cidades com mais postos aderidos"
        subtitle="Até o fim do período. Ao lado, o total de postos da cidade na ANP."
      >
        {data.byCity.length === 0 ? (
          <Typography color="text.secondary">Nenhum posto aderido.</Typography>
        ) : (
          <HorizontalBars
            color={color}
            rows={data.byCity.map((c) => ({
              label: `${c.city}/${c.state}`,
              value: c.adhered,
              suffix: ` de ${number(c.stations)}`,
            }))}
          />
        )}
      </ChartCard>
    </Stack>
  );
}

