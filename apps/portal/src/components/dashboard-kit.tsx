import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import { number } from './dashboard-utils';

/**
 * Peças dos painéis do portal (mesmas do admin, ADR 0037): indicadores,
 * cartões de gráfico, barras horizontais e tabela de apoio.
 */

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
