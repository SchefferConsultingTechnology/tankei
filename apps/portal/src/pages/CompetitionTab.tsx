import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  describePrice,
  formatDistance,
  formatPrice,
  FUEL_LABELS,
  type CurrentPrice,
  type FuelCompetition,
  type FuelType,
} from '@tankei/shared';
import { useState, type ReactNode } from 'react';
import { useCompetition } from '../api/queries';
import { PriceTag } from '../components/PriceTag';

/**
 * Concorrência na região (ADR 0012 e 0020): só o que o app já mostra
 * publicamente (preços vigentes, posição, média da ANP), sem sugestão de preço.
 */
export function CompetitionTab({ stationId }: { stationId: string }) {
  const [radius, setRadius] = useState<number | undefined>(undefined);
  const [chosen, setChosen] = useState<FuelType | null>(null);
  const competition = useCompetition(stationId, radius);

  if (competition.isPending) {
    return <Typography color="text.secondary">Carregando…</Typography>;
  }
  if (competition.isError) {
    return <Alert severity="error">{competition.error.message}</Alert>;
  }
  const { fuels, radiusMeters, maxRadiusMeters } = competition.data;
  if (fuels.length === 0) {
    return <Alert severity="info">Sem combustíveis informados.</Alert>;
  }
  const current = fuels.find((f) => f.fuelType === chosen) ?? fuels[0];

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
        Concorrência na região
      </Typography>

      <Stack direction="row" spacing={1.5}>
        <TextField
          select
          size="small"
          label="Combustível"
          value={current.fuelType}
          onChange={(event) => setChosen(event.target.value as FuelType)}
          sx={{ flex: 2, maxWidth: { sm: 320 } }}
        >
          {fuels.map((f) => (
            <MenuItem key={f.fuelType} value={f.fuelType}>
              {FUEL_LABELS[f.fuelType]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Raio"
          value={radiusMeters}
          onChange={(event) => setRadius(Number(event.target.value))}
          sx={{ flex: 1, maxWidth: { sm: 180 } }}
          slotProps={{
            select: { renderValue: (value) => formatDistance(Number(value)) },
          }}
        >
          {radiusOptions(maxRadiusMeters).map((r) => (
            <MenuItem key={r} value={r}>
              até {formatDistance(r)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stats fuel={current} />

      <Paper
        variant="outlined"
        sx={{ position: 'relative', overflow: 'hidden' }}
      >
        {competition.isFetching && (
          <LinearProgress
            aria-label="Atualizando"
            sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          />
        )}
        <List
          disablePadding
          subheader={
            <ListSubheader
              component="div"
              sx={{ lineHeight: 1.4, py: 1.5, textTransform: 'none' }}
            >
              <Typography
                variant="subtitle2"
                component="span"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  display: 'block',
                }}
              >
                Postos a até {formatDistance(radiusMeters)}
              </Typography>
              <Typography
                variant="body2"
                component="span"
                color="text.secondary"
              >
                {FUEL_LABELS[current.fuelType]}, do mais barato ao mais caro. Só
                aparecem postos com preço vigente no app.
              </Typography>
            </ListSubheader>
          }
        >
          {current.nearby.length === 0 ? (
            <ListItem>
              <Typography variant="body2" color="text.secondary">
                Nenhum posto próximo com preço informado.
              </Typography>
            </ListItem>
          ) : (
            withOwn(current).map((row) => (
              <ListItem
                key={row.key}
                divider
                sx={{
                  gap: 1.5,
                  alignItems: 'flex-start',
                  bgcolor: row.own ? 'action.selected' : undefined,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                  >
                    <Typography noWrap sx={{ fontWeight: 600 }}>
                      {row.name}
                    </Typography>
                    {row.own && (
                      <Chip label="Você" size="small" color="primary" />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {row.detail}
                  </Typography>
                </Box>
                <Box sx={{ flexShrink: 0, pt: 0.25 }}>
                  <PriceTag price={row.price} />
                </Box>
              </ListItem>
            ))
          )}
        </List>
      </Paper>
    </Stack>
  );
}

/** Seu preço, posição na cidade e média da ANP. */
function Stats({ fuel }: { fuel: FuelCompetition }) {
  const reference = fuel.stateReference;
  const diff =
    fuel.price && reference ? fuel.price.price - reference.averagePrice : null;

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
      }}
    >
      <Stat
        label="Seu preço"
        value={fuel.price ? `R$ ${formatPrice(fuel.price.price)}` : '—'}
        detail={fuel.price ? describePrice(fuel.price) : 'Sem preço informado'}
      />
      <Stat
        label="Posição na cidade"
        value={fuel.cityRank ? `${fuel.cityRank.position}º` : '—'}
        detail={
          fuel.cityRank
            ? `de ${fuel.cityRank.total} ${fuel.cityRank.total === 1 ? 'posto' : 'postos'} com preço (1º = mais barato)`
            : 'Informe seu preço para ver a posição'
        }
      />
      <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
        <Stat
          label="Média da ANP no estado"
          value={reference ? `R$ ${formatPrice(reference.averagePrice)}` : '—'}
          detail={
            reference ? (
              <>
                Semana de{' '}
                {new Date(`${reference.weekStart}T12:00`).toLocaleDateString(
                  'pt-BR',
                )}
                {reference.referenceFuel !== fuel.fuelType &&
                  ` (${FUEL_LABELS[reference.referenceFuel].toLowerCase()})`}
                {diff !== null && (
                  <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                    {diffText(diff)}
                  </Box>
                )}
              </>
            ) : (
              'Sem pesquisa da ANP para este combustível'
            )
          }
        />
      </Box>
    </Box>
  );
}

/** Diferença descritiva em relação à média pública (não é sugestão). */
function diffText(diff: number): string {
  const value = Math.abs(Math.round(diff * 1000) / 1000);
  if (value < 0.005) return 'Seu preço está na média';
  return `Seu preço está R$ ${formatPrice(value)} ${diff < 0 ? 'abaixo' : 'acima'} da média`;
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h5"
        component="p"
        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', my: 0.5 }}
      >
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" component="div">
        {detail}
      </Typography>
    </Paper>
  );
}

type Row = {
  key: string;
  own: boolean;
  name: string;
  detail: string;
  price: CurrentPrice;
};

/** Concorrentes com o próprio posto na posição pelo preço. */
function withOwn(fuel: FuelCompetition): Row[] {
  const rows: Row[] = fuel.nearby.map((c) => ({
    key: c.id,
    own: false,
    name: c.name,
    detail: `${c.brand} · ${formatDistance(c.distanceMeters)} · ${describePrice(c.price)}`,
    price: c.price,
  }));
  if (!fuel.price) return rows;
  const own: Row = {
    key: 'own',
    own: true,
    name: 'Seu posto',
    detail: describePrice(fuel.price),
    price: fuel.price,
  };
  // Empate: o próprio posto antes (na posição da cidade, empate conta igual).
  const index = rows.findIndex((r) => r.price.price >= fuel.price!.price);
  rows.splice(index === -1 ? rows.length : index, 0, own);
  return rows;
}

/** Opções de raio até o máximo do parâmetro (o máximo sempre aparece). */
function radiusOptions(max: number): number[] {
  const steps = [1000, 2000, 3000, 5000, 10_000, 20_000, 50_000];
  return [...new Set([...steps.filter((r) => r < max), max])];
}
