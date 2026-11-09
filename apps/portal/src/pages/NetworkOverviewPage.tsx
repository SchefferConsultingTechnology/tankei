import CloseIcon from '@mui/icons-material/Close';
import EditOutlined from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  describePrice,
  formatAge,
  formatPrice,
  FUEL_LABELS,
  roleCan,
  type BulkPriceResult,
  type FuelType,
  type OrganizationOverview,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../api/client';
import { useBulkPrice, useOverview } from '../api/queries';
import { PriceTag } from '../components/PriceTag';
import { usePortalContext } from './station-context';
import { PageLoading } from '../components/PageLoading';

type Unit = OrganizationOverview['stations'][number];
type Result = BulkPriceResult['results'][number];

/**
 * Visão da rede (ADR 0021). Um combustível por vez: a lista das unidades com
 * o preço de cada uma, que também serve para atualizar várias de uma vez.
 * No computador, a tabela de todos os combustíveis fica numa segunda aba.
 */
export function NetworkOverviewPage() {
  const { org } = usePortalContext();
  const overview = useOverview(org.id);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [tab, setTab] = useState<'combustivel' | 'todos'>('combustivel');
  const [fuel, setFuel] = useState<FuelType | null>(null);

  if (overview.isPending) {
    return <PageLoading />;
  }
  if (overview.isError) {
    return <Alert severity="error">{overview.error.message}</Alert>;
  }
  const data = overview.data;
  const current = fuel ?? data.fuels[0];

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {data.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data.stations.length}{' '}
          {data.stations.length === 1 ? 'unidade' : 'unidades'}
        </Typography>
      </Box>

      {data.stations.length === 0 || !current ? (
        <Alert severity="info">Nenhuma unidade no seu escopo.</Alert>
      ) : (
        <>
          {desktop && (
            <Tabs
              value={tab}
              onChange={(_, value: typeof tab) => setTab(value)}
              aria-label="Forma de ver"
            >
              <Tab value="combustivel" label="Por combustível" />
              <Tab value="todos" label="Todos os combustíveis" />
            </Tabs>
          )}
          {desktop && tab === 'todos' ? (
            <AllFuelsTable data={data} />
          ) : (
            <FuelList data={data} fuel={current} onFuel={setFuel} />
          )}
        </>
      )}
    </Stack>
  );
}

function parsePrice(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Lista das unidades no combustível escolhido, com seleção para atualizar. */
function FuelList({
  data,
  fuel,
  onFuel,
}: {
  data: OrganizationOverview;
  fuel: FuelType;
  onFuel: (fuel: FuelType) => void;
}) {
  const navigate = useNavigate();
  const bulk = useBulkPrice(data.id);
  const canUpdate = roleCan(data.role, 'update_price');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [results, setResults] = useState<Map<string, Result>>(new Map());
  const price = parsePrice(text);

  const units = data.stations.filter((s) => s.fuels.includes(fuel));
  const notSelling = data.stations.length - units.length;
  const priceOf = (unit: Unit) => unit.prices.find((p) => p.fuelType === fuel);
  const stale = units.filter((u) => priceOf(u)?.stale).length;
  const missing = units.filter((u) => !priceOf(u)).length;
  const needConfirm = [...results.values()].filter(
    (r) => r.code === 'CONFIRMATION_REQUIRED',
  );

  function changeFuel(next: FuelType) {
    onFuel(next);
    setSelected(new Set());
    setResults(new Map());
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setText('');
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function send(stationIds: string[], confirmed: boolean) {
    if (price === null || stationIds.length === 0) return;
    bulk.mutate(
      { fuelType: fuel, price, stationIds, confirmed },
      {
        onSuccess: (response) => {
          const next = new Map(results);
          for (const r of response.results) next.set(r.stationId, r);
          setResults(next);
          // Só ficam selecionadas as que ainda pedem ação (confirmar).
          setSelected(
            new Set(
              response.results
                .filter((r) => r.code === 'CONFIRMATION_REQUIRED')
                .map((r) => r.stationId),
            ),
          );
        },
      },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setResults(new Map());
    send([...selected], false);
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <TextField
          select
          size="small"
          label="Combustível"
          value={fuel}
          onChange={(event) => changeFuel(event.target.value as FuelType)}
          sx={{ flex: 1, maxWidth: { sm: 360 } }}
        >
          {data.fuels.map((f) => (
            <MenuItem key={f} value={f}>
              {FUEL_LABELS[f]}
            </MenuItem>
          ))}
        </TextField>
        {canUpdate && units.length > 1 && !selecting && (
          <Button
            variant="outlined"
            startIcon={<EditOutlined />}
            onClick={() => setSelecting(true)}
          >
            Atualizar várias
          </Button>
        )}
      </Stack>

      {(stale > 0 || missing > 0) && (
        <Alert severity="warning">
          {[
            stale > 0 &&
              `${stale} ${stale === 1 ? 'unidade com preço desatualizado' : 'unidades com preço desatualizado'}`,
            missing > 0 && `${missing} sem preço informado`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Alert>
      )}

      <Paper variant="outlined">
        <List disablePadding>
          {selecting && (
            <ListItem divider>
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={selected.size === units.length && units.length > 0}
                  indeterminate={
                    selected.size > 0 && selected.size < units.length
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? new Set(units.map((u) => u.id))
                        : new Set(),
                    )
                  }
                  slotProps={{ input: { 'aria-label': 'Selecionar todas' } }}
                />
              </ListItemIcon>
              <ListItemText
                primary={`Todas que vendem ${FUEL_LABELS[fuel].toLowerCase()}`}
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
            </ListItem>
          )}
          {units.map((unit, index) => {
            const p = priceOf(unit);
            const result = results.get(unit.id);
            return (
              <ListItem
                key={unit.id}
                disablePadding
                divider={index < units.length - 1}
              >
                <ListItemButton
                  onClick={() =>
                    selecting
                      ? toggle(unit.id)
                      : navigate(`/postos/${unit.id}/precos`)
                  }
                  sx={{ gap: 1.5, alignItems: 'flex-start' }}
                >
                  {selecting && (
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        tabIndex={-1}
                        checked={selected.has(unit.id)}
                        slotProps={{ input: { 'aria-label': unit.name } }}
                      />
                    </ListItemIcon>
                  )}
                  <ListItemText
                    primary={unit.name}
                    secondary={
                      <>
                        {p ? describePrice(p) : 'Sem preço informado'}
                        {result && (
                          <Box>
                            <ResultChip
                              result={result}
                              unit={unit}
                              fuel={fuel}
                            />
                          </Box>
                        )}
                      </>
                    }
                    sx={{ minWidth: 0 }}
                    slotProps={{
                      primary: { noWrap: true, sx: { fontWeight: 600 } },
                      secondary: { component: 'div' },
                    }}
                  />
                  <Box sx={{ flexShrink: 0, pt: 0.5 }}>
                    <PriceTag price={p} />
                  </Box>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Paper>

      {notSelling > 0 && (
        <Typography variant="body2" color="text.secondary">
          {notSelling}{' '}
          {notSelling === 1 ? 'unidade não vende' : 'unidades não vendem'}{' '}
          {FUEL_LABELS[fuel].toLowerCase()}.
        </Typography>
      )}

      {needConfirm.length > 0 && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              disabled={bulk.isPending}
              onClick={() =>
                send(
                  needConfirm.map((r) => r.stationId),
                  true,
                )
              }
            >
              Está correto
            </Button>
          }
        >
          R$ {price !== null ? formatPrice(price) : ''} é muito diferente do
          preço atual em {needConfirm.map((r) => r.name).join(', ')}.
        </Alert>
      )}
      {bulk.error && (
        <Alert severity="error">
          {bulk.error instanceof ApiError
            ? bulk.error.message
            : 'Não foi possível publicar.'}
        </Alert>
      )}

      {selecting && (
        <Paper
          component="form"
          onSubmit={submit}
          elevation={8}
          sx={{
            position: 'sticky',
            bottom: 0,
            p: 1.5,
            pb: 'calc(12px + env(safe-area-inset-bottom))',
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            zIndex: 2,
          }}
        >
          <IconButton aria-label="Cancelar seleção" onClick={stopSelecting}>
            <CloseIcon />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 96 }}>
            {selected.size}{' '}
            {selected.size === 1 ? 'selecionada' : 'selecionadas'}
          </Typography>
          <TextField
            size="small"
            label="Novo preço"
            placeholder="6,29"
            value={text}
            onChange={(event) => setText(event.target.value)}
            sx={{ flex: 1, minWidth: 120 }}
            slotProps={{
              htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">R$</InputAdornment>
                ),
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={price === null || selected.size === 0 || bulk.isPending}
          >
            {bulk.isPending ? 'Publicando…' : 'Publicar'}
          </Button>
        </Paper>
      )}
    </Stack>
  );
}

/** Resultado da publicação na linha da unidade. */
function ResultChip({
  result,
  unit,
  fuel,
}: {
  result: Result;
  unit: Unit;
  fuel: FuelType;
}) {
  if (result.ok) {
    const promo = unit.prices.find((p) => p.fuelType === fuel)?.promotion;
    return (
      <Chip
        size="small"
        color="success"
        variant="outlined"
        label={
          promo
            ? `Publicado · vale depois da promoção “${promo.label}”`
            : 'Publicado'
        }
        sx={{ mt: 0.5, maxWidth: '100%' }}
      />
    );
  }
  if (result.code === 'CONFIRMATION_REQUIRED') {
    return (
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        label="Confirmar valor"
        sx={{ mt: 0.5 }}
      />
    );
  }
  return (
    <Chip
      size="small"
      color="error"
      variant="outlined"
      label={`Não publicado: ${result.message}`}
      sx={{ mt: 0.5, maxWidth: '100%' }}
    />
  );
}

/** Tabela unidades × combustíveis (computador). */
function AllFuelsTable({ data }: { data: OrganizationOverview }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Preços por unidade e combustível">
        <TableHead>
          <TableRow>
            <TableCell>Unidade</TableCell>
            {data.fuels.map((fuel) => (
              <TableCell key={fuel}>{FUEL_LABELS[fuel]}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.stations.map((s) => (
            <TableRow key={s.id} hover>
              <TableCell component="th" scope="row">
                <Typography
                  component={Link}
                  to={`/postos/${s.id}/precos`}
                  variant="body2"
                  sx={{ fontWeight: 600, color: 'text.primary' }}
                >
                  {s.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                >
                  {s.city}/{s.state}
                </Typography>
              </TableCell>
              {data.fuels.map((fuel) => {
                if (!s.fuels.includes(fuel)) {
                  return (
                    <TableCell key={fuel} sx={{ color: 'text.disabled' }}>
                      não vende
                    </TableCell>
                  );
                }
                const price = s.prices.find((p) => p.fuelType === fuel);
                return (
                  <TableCell key={fuel}>
                    <PriceTag price={price} />
                    {price && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                      >
                        {formatAge(price.updatedAt)}
                      </Typography>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
