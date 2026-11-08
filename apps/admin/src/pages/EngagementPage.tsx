import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import type { EngagementDashboard } from '@tankei/shared';
import { useState } from 'react';
import { useEngagementDashboard } from '../api/admin-queries';
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

type Region = EngagementDashboard['regions']['rows'][number];

const coverage = (r: Pick<Region, 'stations' | 'stationsWithAny'>) =>
  r.stations > 0 ? (r.stationsWithAny / r.stations) * 100 : 0;

const percent = (value: number) =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;

/** Região com muitos postos e pouca interação: onde o marketing rende mais. */
const OPPORTUNITY_MIN_STATIONS = 20;
const OPPORTUNITY_MAX_COVERAGE = 10;

/**
 * Engajamento dos motoristas (ADR 0038): postos que receberam preços e
 * avaliações, por estado ou cidade, para direcionar o marketing.
 */
export function EngagementPage() {
  const filters = useDashboardFilters();
  const dashboard = useEngagementDashboard(filters.query);
  const data = dashboard.data;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Engajamento dos motoristas"
        subtitle="Postos que receberam preços e avaliações de motoristas. Preços informados pelos próprios postos não entram aqui."
      />
      <DashboardFilters filters={filters} />
      {dashboard.isFetching && data && <LinearProgress />}
      {dashboard.isPending ? (
        <PageLoading />
      ) : dashboard.isError ? (
        <Alert severity="error">{dashboard.error.message}</Alert>
      ) : (
        <EngagementContent data={data!} />
      )}
    </Stack>
  );
}

function EngagementContent({ data }: { data: EngagementDashboard }) {
  const theme = useTheme();
  const color = SERIES[theme.palette.mode];
  const { kpis, period, regions } = data;
  const labels = data.series.map((p) => bucketLabel(p.start, period.granularity));
  const regionWord = regions.level === 'estado' ? 'estado' : 'cidade';
  const regionLabel = (r: Region) =>
    regions.level === 'estado' ? r.state : r.name;

  const byCoverage = regions.rows
    .filter((r) => r.stationsWithAny > 0)
    .sort((a, b) => coverage(b) - coverage(a))
    .slice(0, 12);
  const opportunities = regions.rows
    .filter(
      (r) =>
        r.stations >= OPPORTUNITY_MIN_STATIONS &&
        coverage(r) < OPPORTUNITY_MAX_COVERAGE,
    )
    .sort((a, b) => b.stations - a.stations)
    .slice(0, 8);

  return (
    <Stack spacing={2.5}>
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
          label="Postos com interação"
          value={number(kpis.stationsWithAny)}
          hint={`${percent(coverage({ stations: kpis.stationsInScope, stationsWithAny: kpis.stationsWithAny }))} dos ${number(kpis.stationsInScope)} postos`}
        />
        <StatTile
          label="Informes de preço"
          value={number(kpis.priceReports)}
          delta={kpis.priceReports - kpis.previous.priceReports}
          hint={`em ${number(kpis.stationsWithPrices)} postos · vs período anterior`}
        />
        <StatTile
          label="Avaliações"
          value={number(kpis.reviews)}
          delta={kpis.reviews - kpis.previous.reviews}
          hint={`em ${number(kpis.stationsWithReviews)} postos · vs período anterior`}
        />
        <StatTile
          label="Motoristas ativos"
          value={number(kpis.activeUsers)}
          delta={kpis.activeUsers - kpis.previous.activeUsers}
          hint="informaram ou avaliaram · vs período anterior"
        />
        <StatTile
          label="Informes por motorista"
          value={
            kpis.activeUsers > 0
              ? (kpis.priceReports / kpis.activeUsers).toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                })
              : '—'
          }
          hint="média no período"
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
          title={`Informes de preço ${GRANULARITY_LABEL[period.granularity]}`}
          table={
            <SimpleTable
              head={['Início', 'Informes', 'Avaliações']}
              rows={data.series.map((p, i) => [
                labels[i],
                number(p.priceReports),
                number(p.reviews),
              ])}
            />
          }
        >
          <BarChart
            height={240}
            xAxis={[{ scaleType: 'band', data: labels, categoryGapRatio: 0.45 }]}
            yAxis={[{ tickMinStep: 1, width: 44 }]}
            series={[
              {
                data: data.series.map((p) => p.priceReports),
                label: 'Informes de preço',
                color,
              },
            ]}
            borderRadius={4}
            grid={{ horizontal: true }}
            hideLegend
            margin={{ left: 0, right: 8 }}
          />
        </ChartCard>
        <ChartCard title={`Avaliações ${GRANULARITY_LABEL[period.granularity]}`}>
          <BarChart
            height={240}
            xAxis={[{ scaleType: 'band', data: labels, categoryGapRatio: 0.45 }]}
            yAxis={[{ tickMinStep: 1, width: 44 }]}
            series={[
              {
                data: data.series.map((p) => p.reviews),
                label: 'Avaliações',
                color,
              },
            ]}
            borderRadius={4}
            grid={{ horizontal: true }}
            hideLegend
            margin={{ left: 0, right: 8 }}
          />
        </ChartCard>

        <ChartCard
          title={`Cobertura por ${regionWord}`}
          subtitle="Parte dos postos com preço ou avaliação de motoristas no período."
        >
          {byCoverage.length === 0 ? (
            <Typography color="text.secondary">
              Nenhuma interação no período.
            </Typography>
          ) : (
            <HorizontalBars
              color={color}
              rows={byCoverage.map((r) => ({
                label: regions.level === 'estado' ? r.state : r.name,
                value: coverage(r),
                display: percent(coverage(r)),
                suffix: ` · ${number(r.stationsWithAny)} de ${number(r.stations)}`,
              }))}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Oportunidades de marketing"
          subtitle={`${regionWord === 'estado' ? 'Estados' : 'Cidades'} com pelo menos ${OPPORTUNITY_MIN_STATIONS} postos e menos de ${OPPORTUNITY_MAX_COVERAGE}% de cobertura, dos maiores para os menores.`}
        >
          {opportunities.length === 0 ? (
            <Typography color="text.secondary">
              Nenhuma {regionWord} nessa situação.
            </Typography>
          ) : (
            <HorizontalBars
              color={color}
              rows={opportunities.map((r) => ({
                label: regionLabel(r),
                value: r.stations,
                suffix: ` postos · ${percent(coverage(r))}`,
              }))}
            />
          )}
        </ChartCard>
      </Box>

      <ChartCard
        title={`Por ${regionWord}`}
        subtitle={
          regions.level === 'estado'
            ? 'Escolha um estado no filtro para ver as cidades. Clique no título de uma coluna para ordenar.'
            : 'Até 60 cidades: todas as que tiveram interação e as maiores sem interação. Clique no título de uma coluna para ordenar.'
        }
      >
        <RegionTable rows={regions.rows} level={regions.level} />
      </ChartCard>
    </Stack>
  );
}

type SortKey =
  | 'name'
  | 'stations'
  | 'stationsWithAny'
  | 'coverage'
  | 'priceReports'
  | 'reviews'
  | 'activeUsers';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'stations', label: 'Postos' },
  { key: 'stationsWithAny', label: 'Com interação' },
  { key: 'coverage', label: 'Cobertura' },
  { key: 'priceReports', label: 'Informes' },
  { key: 'reviews', label: 'Avaliações' },
  { key: 'activeUsers', label: 'Motoristas' },
];

/** Tabela ordenável por qualquer coluna. */
function RegionTable({
  rows,
  level,
}: {
  rows: Region[];
  level: 'estado' | 'cidade';
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'stations',
    desc: true,
  });
  const value = (r: Region, key: SortKey) =>
    key === 'coverage' ? coverage(r) : key === 'name' ? 0 : r[key];
  const sorted = [...rows].sort((a, b) => {
    if (sort.key === 'name') {
      const cmp = (level === 'estado' ? a.state : a.name).localeCompare(
        level === 'estado' ? b.state : b.name,
      );
      return sort.desc ? -cmp : cmp;
    }
    const diff = value(a, sort.key) - value(b, sort.key);
    return sort.desc ? -diff : diff;
  });
  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' },
    );

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            <TableCell>
              <TableSortLabel
                active={sort.key === 'name'}
                direction={sort.desc ? 'desc' : 'asc'}
                onClick={() => toggle('name')}
              >
                {level === 'estado' ? 'Estado' : 'Cidade'}
              </TableSortLabel>
            </TableCell>
            {COLUMNS.map((c) => (
              <TableCell key={c.key} align="right">
                <TableSortLabel
                  active={sort.key === c.key}
                  direction={sort.desc ? 'desc' : 'asc'}
                  onClick={() => toggle(c.key)}
                >
                  {c.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={`${r.state}-${r.name}`} hover>
              <TableCell>
                {level === 'estado' ? r.state : `${r.name}/${r.state}`}
              </TableCell>
              <TableCell align="right">{number(r.stations)}</TableCell>
              <TableCell align="right">{number(r.stationsWithAny)}</TableCell>
              <TableCell align="right">{percent(coverage(r))}</TableCell>
              <TableCell align="right">{number(r.priceReports)}</TableCell>
              <TableCell align="right">{number(r.reviews)}</TableCell>
              <TableCell align="right">{number(r.activeUsers)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
