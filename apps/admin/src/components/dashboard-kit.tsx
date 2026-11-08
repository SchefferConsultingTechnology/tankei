import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import { BRAZIL_STATES } from '@tankei/shared';
import { useState, type ReactNode } from 'react';
import {
  number,
  PRESETS,
  type Preset,
  type useDashboardFilters,
} from './dashboard-utils';

/**
 * Peças comuns aos dashboards do admin (ADR 0037 e 0038): filtros, indicadores,
 * cartões de gráfico, barras horizontais e tabela de apoio.
 */

/** Filtros numa linha, acima dos gráficos. */
export function DashboardFilters({
  filters,
}: {
  filters: ReturnType<typeof useDashboardFilters>;
}) {
  const { preset, range, state } = filters;
  return (
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
            if (value) filters.choosePreset(value);
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
            onChange={(e) => filters.setFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            type="date"
            size="small"
            label="Até"
            value={range.to}
            onChange={(e) => filters.setTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
        </Stack>
        <TextField
          select
          size="small"
          label="Estado"
          value={state}
          onChange={(e) => filters.setState(e.target.value)}
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
  );
}

export function StatTile({
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
      <Stack
        direction="row"
        useFlexGap
        sx={{ alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1 }}
      >
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

export function ChartCard({
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
 * Barras horizontais com o valor ao lado, uma cor só. Uma grade única para a
 * lista inteira: o trilho das barras tem a mesma largura em todas as linhas,
 * então os comprimentos são comparáveis. Feitas em HTML para os nomes longos
 * (cidades) não serem cortados; no celular, o nome vai acima da barra.
 */
export function HorizontalBars({
  rows,
  color,
}: {
  rows: {
    label: string;
    value: number;
    /** Texto em destaque ao lado da barra (padrão: o valor). */
    display?: string;
    suffix?: string;
  }[];
  color: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        p: 0,
        m: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr) max-content',
          sm: 'minmax(96px, max-content) minmax(0, 1fr) max-content',
        },
        alignItems: 'center',
        columnGap: 1.5,
        rowGap: { xs: 0.25, sm: 1.25 },
      }}
    >
      {rows.map((r) => {
        const text = r.display ?? number(r.value);
        return (
          <Box
            component="li"
            key={r.label}
            sx={{ display: 'contents' }}
            aria-label={`${r.label}: ${text}${r.suffix ?? ''}`}
          >
            <Typography
              variant="body2"
              noWrap
              title={r.label}
              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, mt: { xs: 1, sm: 0 } }}
            >
              {r.label}
            </Typography>
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  height: 16,
                  width: `${(r.value / max) * 100}%`,
                  minWidth: r.value > 0 ? 4 : 0,
                  bgcolor: color,
                  borderRadius: '0 4px 4px 0',
                }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {text}
              <Typography component="span" variant="body2" color="text.secondary">
                {r.suffix}
              </Typography>
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
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
