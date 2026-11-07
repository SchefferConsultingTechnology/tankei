import AddOutlined from '@mui/icons-material/AddOutlined';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  describeDiscount,
  discountedPrice,
  FUEL_LABELS,
  formatPrice,
  type Agreement,
  type AgreementDiscount,
  type DiscountKind,
  type FuelType,
  type StationAgreement,
} from '@tankei/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import {
  useAgreementSearch,
  useCreateAgreement,
  useEndStationAgreement,
  useSetStationAgreement,
  useStationAgreements,
} from '../api/queries';
import { PageLoading } from '../components/PageLoading';
import { useCan, useStationContext } from './station-context';

const errorText = (error: unknown) =>
  error
    ? error instanceof ApiError
      ? error.message
      : 'Não foi possível concluir. Tente de novo.'
    : null;

/**
 * Convênios do posto (ADR 0034): o desconto de cada convênio, por
 * combustível. O preço no mapa continua sem desconto; o desconto aparece no
 * cartão do posto e na ficha.
 */
export function AgreementsPage() {
  const { station } = useStationContext();
  const canManage = useCan('manage_promotions');
  const list = useStationAgreements(station.id);
  const end = useEndStationAgreement(station.id);
  const [editing, setEditing] = useState<StationAgreement | 'novo' | null>(
    null,
  );
  const [ending, setEnding] = useState<StationAgreement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const priceOf = (fuel: FuelType) =>
    station.prices.find((p) => p.fuelType === fuel)?.price;

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            Convênios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            O desconto aparece no cartão do posto e na ficha do app. O preço
            no mapa e na lista continua sem desconto.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setEditing('novo')}
            sx={{ flexShrink: 0 }}
          >
            Adicionar
          </Button>
        )}
      </Stack>

      {list.isPending ? (
        <PageLoading />
      ) : list.isError ? (
        <Alert severity="error">{list.error.message}</Alert>
      ) : list.data.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography color="text.secondary">
            Nenhum convênio com desconto. Exemplos: apps de pagamento, cartões
            de frota, clubes e cooperativas.
          </Typography>
        </Paper>
      ) : (
        list.data.map((item) => (
          <Paper key={item.agreement.id} variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ justifyContent: 'space-between' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {item.agreement.name}
                </Typography>
                {item.note && (
                  <Typography variant="body2" color="text.secondary">
                    {item.note}
                  </Typography>
                )}
                <Stack spacing={0.25} sx={{ mt: 1 }}>
                  {item.discounts.map((d) => {
                    const price = priceOf(d.fuelType);
                    return (
                      <Typography key={d.fuelType} variant="body2">
                        {FUEL_LABELS[d.fuelType]}: {describeDiscount(d)}
                        {price !== undefined &&
                          ` · R$ ${formatPrice(price)} → R$ ${formatPrice(discountedPrice(price, d))}`}
                      </Typography>
                    );
                  })}
                </Stack>
              </Box>
              {canManage && (
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button onClick={() => setEditing(item)}>Editar</Button>
                  <Button color="error" onClick={() => setEnding(item)}>
                    Encerrar
                  </Button>
                </Stack>
              )}
            </Stack>
          </Paper>
        ))
      )}

      {editing && (
        <AgreementDialog
          stationId={station.id}
          fuels={station.fuels}
          priceOf={priceOf}
          current={editing === 'novo' ? null : editing}
          taken={(list.data ?? []).map((a) => a.agreement.id)}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            setNotice(`Convênio ${name} salvo. Já aparece no app.`);
          }}
        />
      )}

      <Dialog open={ending !== null} onClose={() => setEnding(null)}>
        <DialogTitle>Encerrar o convênio?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            O desconto de {ending?.agreement.name} deixa de aparecer no app.
            Você pode cadastrar de novo depois.
          </DialogContentText>
          {end.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(end.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnding(null)}>Cancelar</Button>
          <Button
            color="error"
            disabled={end.isPending}
            onClick={() =>
              ending &&
              end.mutate(ending.agreement.id, {
                onSuccess: () => {
                  setNotice(`Convênio ${ending.agreement.name} encerrado.`);
                  setEnding(null);
                },
              })
            }
          >
            Encerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        message={notice}
      />
    </Stack>
  );
}

type Row = { enabled: boolean; kind: DiscountKind; value: string };

/** Opção "Cadastrar …" da lista de convênios. */
const NEW_OPTION = '__novo__';

/**
 * Desconto digitado só com números, como o preço no app: as duas últimas
 * casas são os centavos (R$/L) ou a parte decimal (%). "20" = 0,20.
 */
const MAX_DISCOUNT_DIGITS = 5;
const toDigits = (text: string) =>
  text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DISCOUNT_DIGITS);
const parseValue = (digits: string) => {
  const value = Number(digits || '0') / 100;
  return value > 0 ? value : null;
};
const formatDigits = (digits: string) =>
  digits
    ? (Number(digits) / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '';

function AgreementDialog({
  stationId,
  fuels,
  priceOf,
  current,
  taken,
  onClose,
  onSaved,
}: {
  stationId: string;
  fuels: FuelType[];
  priceOf: (fuel: FuelType) => number | undefined;
  current: StationAgreement | null;
  taken: string[];
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const save = useSetStationAgreement(stationId);
  const create = useCreateAgreement();
  const [agreement, setAgreement] = useState<Agreement | null>(
    current?.agreement ?? null,
  );
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const search = useAgreementSearch(query);
  const [note, setNote] = useState(current?.note ?? '');
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      fuels.map((fuel) => {
        const d = current?.discounts.find((x) => x.fuelType === fuel);
        return [
          fuel,
          {
            enabled: d !== undefined,
            kind: d?.kind ?? 'reais_litro',
            value: d ? String(Math.round(d.value * 100)) : '',
          },
        ];
      }),
    ),
  );

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const discounts: AgreementDiscount[] = fuels.flatMap((fuel) => {
    const row = rows[fuel];
    const value = row?.enabled ? parseValue(row.value) : null;
    return value === null ? [] : [{ fuelType: fuel, kind: row.kind, value }];
  });
  const invalidRow = fuels.some(
    (fuel) => rows[fuel]?.enabled && parseValue(rows[fuel].value) === null,
  );
  const valid = agreement !== null && discounts.length > 0 && !invalidRow;

  const options = (search.data ?? []).filter(
    (a) => !taken.includes(a.id) || a.id === current?.agreement.id,
  );
  const exact = options.some(
    (a) => a.name.toLowerCase() === input.trim().toLowerCase(),
  );
  // "Cadastrar …" entra como última opção da lista, quando o nome é novo.
  const typed = input.trim();
  const choices: Agreement[] =
    typed.length >= 2 && !exact && agreement?.name !== typed
      ? [...options, { id: NEW_OPTION, name: typed, description: null }]
      : options;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || !agreement) return;
    save.mutate(
      {
        agreementId: agreement.id,
        body: { discounts, note: note.trim() || undefined },
      },
      { onSuccess: () => onSaved(agreement.name) },
    );
  }

  const setRow = (fuel: FuelType, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [fuel]: { ...r[fuel], ...patch } }));

  return (
    <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>
          {current ? `Convênio ${current.agreement.name}` : 'Adicionar convênio'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!current && (
              <Stack spacing={1}>
                <Autocomplete
                  options={choices}
                  value={agreement}
                  onChange={(_, value) => {
                    if (value?.id === NEW_OPTION) {
                      create.mutate(
                        { name: value.name },
                        { onSuccess: (created) => setAgreement(created) },
                      );
                      return;
                    }
                    setAgreement(value);
                  }}
                  inputValue={input}
                  onInputChange={(_, value) => setInput(value)}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  filterOptions={(o) => o}
                  loading={search.isFetching}
                  noOptionsText="Digite o nome do convênio"
                  renderOption={({ key, ...props }, option) => (
                    <li key={key} {...props}>
                      {option.id === NEW_OPTION ? (
                        <Typography color="primary" sx={{ fontWeight: 600 }}>
                          + Cadastrar “{option.name}” como novo convênio
                        </Typography>
                      ) : (
                        option.name
                      )}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      autoFocus
                      label="Convênio"
                      placeholder="Ex.: app de pagamento, cartão de frota"
                    />
                  )}
                />
                {create.error && (
                  <Alert severity="error">{errorText(create.error)}</Alert>
                )}
              </Stack>
            )}

            <Typography variant="body2" color="text.secondary">
              Desconto por combustível, em R$ por litro ou em %.
            </Typography>
            {fuels.map((fuel) => {
              const row = rows[fuel];
              const value = row.enabled ? parseValue(row.value) : null;
              const price = priceOf(fuel);
              return (
                <Box key={fuel}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={row.enabled}
                        onChange={(e) =>
                          setRow(fuel, { enabled: e.target.checked })
                        }
                      />
                    }
                    label={FUEL_LABELS[fuel]}
                  />
                  {row.enabled && (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', ml: 4, flexWrap: 'wrap', rowGap: 1 }}
                    >
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        color="primary"
                        value={row.kind}
                        onChange={(_, kind: DiscountKind | null) =>
                          kind && setRow(fuel, { kind })
                        }
                      >
                        <ToggleButton value="reais_litro">R$/L</ToggleButton>
                        <ToggleButton value="percentual">%</ToggleButton>
                      </ToggleButtonGroup>
                      <TextField
                        size="small"
                        label="Desconto"
                        value={formatDigits(row.value)}
                        onChange={(e) =>
                          setRow(fuel, { value: toDigits(e.target.value) })
                        }
                        placeholder="0,00"
                        sx={{ width: 140 }}
                        slotProps={{
                          htmlInput: { inputMode: 'numeric', autoComplete: 'off' },
                          input: {
                            startAdornment:
                              row.kind === 'reais_litro' ? (
                                <InputAdornment position="start">R$</InputAdornment>
                              ) : undefined,
                            endAdornment:
                              row.kind === 'percentual' ? (
                                <InputAdornment position="end">%</InputAdornment>
                              ) : undefined,
                          },
                        }}
                      />
                      {price !== undefined && value !== null && (
                        <Typography variant="body2" color="text.secondary">
                          R$ {formatPrice(price)} → R${' '}
                          {formatPrice(
                            discountedPrice(price, { kind: row.kind, value }),
                          )}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Box>
              );
            })}

            <TextField
              label="Observação (opcional)"
              placeholder="Ex.: pagando pelo app, acima de 30 litros"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 140 } }}
            />
            {save.error && <Alert severity="error">{errorText(save.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={!valid || save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
