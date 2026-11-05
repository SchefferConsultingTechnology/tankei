import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  BRAZIL_STATES,
  FUEL_LABELS,
  formatPrice,
  type CityFuelStats,
  type CityWithStations,
} from '@tankei/shared';
import { useState } from 'react';
import { useCities, useCityComparison } from '../api/queries';
import { useStationContext } from './station-context';

const money = (value: number | null) =>
  value === null ? '—' : `R$ ${formatPrice(value)}`;

/** Sem acento e em minúsculas, para a busca: "São José" → "sao jose". */
function searchable(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Preços de outra cidade comparados aos do posto (só dados públicos, ADR 0012). */
export function CitiesPage() {
  const { station } = useStationContext();
  const [state, setState] = useState<string>(station.state);
  const [city, setCity] = useState<CityWithStations | null>(null);
  const cities = useCities(state);
  const comparison = useCityComparison(station.id, city?.code ?? '');

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
        Comparar com outra cidade
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          select
          size="small"
          label="Estado"
          value={state}
          onChange={(event) => {
            setState(event.target.value);
            setCity(null);
          }}
          sx={{ flex: 1, maxWidth: { sm: 240 } }}
        >
          {BRAZIL_STATES.map((s) => (
            <MenuItem key={s.code} value={s.code}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <Autocomplete
          size="small"
          sx={{ flex: 2, maxWidth: { sm: 420 } }}
          options={cities.data ?? []}
          loading={cities.isPending}
          value={city}
          onChange={(_, value) => setCity(value)}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(a, b) => a.code === b.code}
          filterOptions={(options, { inputValue }) => {
            const term = searchable(inputValue.trim());
            return term
              ? options.filter((o) => searchable(o.name).includes(term))
              : options;
          }}
          renderOption={({ key, ...props }, option) => (
            <li key={key} {...props}>
              <Box sx={{ flex: 1 }}>{option.name}</Box>
              <Typography variant="body2" color="text.secondary">
                {option.stations} {option.stations === 1 ? 'posto' : 'postos'}
              </Typography>
            </li>
          )}
          noOptionsText="Nenhuma cidade encontrada"
          loadingText="Carregando cidades…"
          renderInput={(params) => (
            <TextField {...params} label="Cidade" placeholder="Digite o nome" />
          )}
        />
      </Stack>

      {comparison.isFetching && <LinearProgress aria-label="Carregando" />}
      {comparison.isError && (
        <Alert severity="error">{comparison.error.message}</Alert>
      )}
      {!city && (
        <Alert severity="info">
          Escolha uma cidade para ver o menor preço, a média, a mediana e a
          posição que o seu posto teria lá.
        </Alert>
      )}

      {city && comparison.data && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {comparison.data.municipality.name}/
            {comparison.data.municipality.state}
          </Typography>
          {comparison.data.fuels.map((f) => (
            <FuelCard key={f.fuelType} stats={f} />
          ))}
        </Stack>
      )}

      <Typography variant="body2" color="text.secondary">
        Só entram preços vigentes que o app mostra aos consumidores.
      </Typography>
    </Stack>
  );
}

function FuelCard({ stats }: { stats: CityFuelStats }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}
      >
        <Typography sx={{ fontWeight: 700 }}>
          {FUEL_LABELS[stats.fuelType]}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {stats.stations === 0
            ? 'Sem preços nesta cidade'
            : `${stats.stations} ${stats.stations === 1 ? 'posto' : 'postos'} com preço`}
        </Typography>
      </Stack>

      {stats.stations > 0 && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
              gap: 1.5,
              mt: 1.5,
            }}
          >
            <Figure label="Seu preço" value={money(stats.ownPrice)} strong />
            <Figure label="Menor lá" value={money(stats.min)} />
            <Figure label="Média lá" value={money(stats.average)} />
            <Figure label="Mediana lá" value={money(stats.median)} />
          </Box>
          {stats.positionThere && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Com o seu preço, o posto seria o{' '}
              <strong>{stats.positionThere.position}º</strong> de{' '}
              {stats.positionThere.total} nessa cidade, contando o seu (1º =
              mais barato).
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
}

function Figure({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: strong ? 800 : 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
