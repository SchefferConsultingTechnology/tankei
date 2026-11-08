import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import {
  BRAZIL_STATES,
  type AdhesionDashboard,
  type ClaimOrigin,
  type DashboardGranularity,
} from '@tankei/shared';
import { useState, type ReactNode } from 'react';
import { useAdhesionDashboard } from '../api/admin-queries';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';

/** Cor única dos gráficos (uma série cada), validada nos dois temas. */
const SERIES = { light: '#2a78d6', dark: '#3987e5' } as const;

const PRESETS = [
  { value: '30d', label: '30 dias', days: 30 },
  { value: '90d', label: '90 dias', days: 90 },
  { value: '12m', label: '12 meses', days: 365 },
  { value: 'ano', label: 'Este ano', days: null },
] as const;
type Preset = (typeof PRESETS)[number]['value'] | 'livre';

/** Data local (Brasília no uso real) em AAAA-MM-DD. */
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presetRange(preset: Preset): { from: string; to: string } | null {
  const today = new Date();
  const found = PRESETS.find((p) => p.value === preset);
  if (!found) return null;
  if (found.days === null) {
    return { from: `${today.getFullYear()}-01-01`, to: isoDay(today) };
  }
  const from = new Date(today);
  from.setDate(from.getDate() - found.days + 1);
  return { from: isoDay(from), to: isoDay(today) };
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function bucketLabel(start: string, granularity: DashboardGranularity) {
  const [y, m, d] = start.split('-').map(Number);
  if (granularity === 'mes') return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

const GRANULARITY_LABEL: Record<DashboardGranularity, string> = {
  dia: 'por dia',
  semana: 'por semana',
  mes: 'por mês',
};

const number = (n: number) => n.toLocaleString('pt-BR');

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
  const [preset, setPreset] = useState<Preset>('12m');
  const [range, setRange] = useState(() => presetRange('12m')!);
  const [state, setState] = useState('');
  const dashboard = useAdhesionDashboard({
    from: range.from,
    to: range.to,
    state: state || undefined,
  });
  const data = dashboard.data;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Adesão de postos"
        subtitle="Postos que entraram no portal (pedido aprovado ou vínculo feito pela equipe)."
      />

      {/* Filtros numa linha, acima dos gráficos. */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        useFlexGap
        sx={{
          alignItems: { md: 'center' },
          flexWrap: { md: 'wrap' },
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={preset}
          onChange={(_, value: Preset | null) => {
            if (!value) return;
            setPreset(value);
            const next = presetRange(value);
            if (next) setRange(next);
          }}
          aria-label="Período"
        >
          {PRESETS.map((p) => (
            <ToggleButton key={p.value} value={p.value}>
              {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
          <TextField
            type="date"
            size="small"
            label="De"
            value={range.from}
            onChange={(e) => {
              setPreset('livre');
              setRange((r) => ({ ...r, from: e.target.value }));
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            type="date"
            size="small"
            label="Até"
            value={range.to}
            onChange={(e) => {
              setPreset('livre');
              setRange((r) => ({ ...r, to: e.target.value }));
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
        </Stack>
        <TextField
          select
          size="small"
          label="Estado"
          value={state}
          onChange={(e) => setState(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {BRAZIL_STATES.map((s) => (
            <MenuItem key={s.code} value={s.code}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
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

function StatTile({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint: string;
  /** Diferença com o período anterior (subir é bom). */
  delta?: number;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
        <Typography sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.3 }}>
          {value}
        </Typography>
        {delta !== undefined && delta !== 0 && (
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              color: delta > 0 ? 'success.main' : 'error.main',
            }}
          >
            {delta > 0 ? (
              <ArrowUpwardRounded fontSize="small" />
            ) : (
              <ArrowDownwardRounded fontSize="small" />
            )}
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {delta > 0 ? '+' : ''}
              {number(delta)}
            </Typography>
          </Stack>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {hint}
      </Typography>
    </Paper>
  );
}

function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Tabela com os mesmos números (acessibilidade). */
  table?: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {table && (
          <Button size="small" onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'Gráfico' : 'Tabela'}
          </Button>
        )}
      </Stack>
      <Box sx={{ mt: 1 }}>{showTable && table ? table : children}</Box>
    </Paper>
  );
}

/**
 * Barras horizontais com o valor na ponta: comparação ordenada, uma cor só.
 * Feitas em HTML para os rótulos longos (cidades) não serem cortados.
 */
function HorizontalBars({
  rows,
  color,
}: {
  rows: { label: string; value: number; suffix?: string }[];
  color: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Stack spacing={1.25} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {rows.map((r) => (
        <Box
          component="li"
          key={r.label}
          sx={{
            display: 'grid',
            // No celular, o nome em cima da barra (sem cortar).
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'minmax(120px, 30%) minmax(0, 1fr)',
            },
            alignItems: 'center',
            columnGap: 1.5,
            rowGap: 0.25,
          }}
          aria-label={`${r.label}: ${number(r.value)}${r.suffix ?? ''}`}
        >
          <Typography variant="body2" noWrap title={r.label}>
            {r.label}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Box
              sx={{
                height: 16,
                width: `${(r.value / max) * 85}%`,
                minWidth: r.value > 0 ? 4 : 0,
                bgcolor: color,
                borderRadius: '0 4px 4px 0',
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
              {number(r.value)}
              <Typography component="span" variant="body2" color="text.secondary">
                {r.suffix}
              </Typography>
            </Typography>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <Box sx={{ maxHeight: 260, overflow: 'auto' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {head.map((h, i) => (
              <TableCell key={h} align={i === 0 ? 'left' : 'right'}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row[0]}>
              {row.map((cell, i) => (
                <TableCell key={i} align={i === 0 ? 'left' : 'right'}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
