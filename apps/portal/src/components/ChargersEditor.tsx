import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  CHARGER_ACCESS,
  CHARGER_ACCESS_LABELS,
  CHARGER_CURRENT_LABELS,
  CHARGER_CURRENTS,
  CHARGER_PAYMENT_LABELS,
  CHARGER_PAYMENTS,
  CONNECTOR_LABELS,
  CONNECTORS,
  type Charger,
  type ChargingAdmin,
  type SetChargers,
} from '@tankei/shared';
import { useState } from 'react';

/** Linha do formulário: números como texto, para digitar com vírgula. */
interface Row {
  current: Charger['current'];
  connector: Charger['connector'];
  powerKw: string;
  count: string;
  access: Charger['access'];
  payments: Charger['payments'];
  operator: string;
  timeBased: boolean;
  fees: string;
}

const toRow = (c: Charger): Row => ({
  current: c.current,
  connector: c.connector,
  powerKw: String(c.powerKw).replace('.', ','),
  count: String(c.count),
  access: c.access,
  payments: c.payments,
  operator: c.operator ?? '',
  timeBased: c.timeBased,
  fees: c.fees ?? '',
});

/** Ponto novo: DC/CCS2, ou AC/Tipo 2 se já houver um DC. */
const emptyRow = (rows: Row[]): Row => ({
  ...(rows.some((r) => r.current === 'dc')
    ? { current: 'ac' as const, connector: 'tipo2' as const }
    : { current: 'dc' as const, connector: 'ccs2' as const }),
  powerKw: '',
  count: '1',
  access: 'publico',
  payments: [],
  operator: '',
  timeBased: false,
  fees: '',
});

const number = (text: string) => Number(text.trim().replace(',', '.'));

/**
 * Pontos de recarga do posto (ADR 0041), usado no portal e no admin. Uma linha
 * por tipo de ponto (corrente, conector e potência). O preço por kWh é
 * informado em Preços atuais, como um combustível.
 */
export function ChargersEditor({
  data,
  canEdit,
  saving,
  error,
  onSave,
}: {
  data: ChargingAdmin;
  canEdit: boolean;
  saving: boolean;
  error: string | null;
  onSave: (body: SetChargers) => void;
}) {
  const [rows, setRows] = useState<Row[]>(
    () => data.official?.chargers.map(toRow) ?? [],
  );
  const update = (i: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const invalid = rows.some(
    (r) =>
      !(number(r.powerKw) > 0) ||
      !Number.isInteger(number(r.count)) ||
      number(r.count) < 1,
  );

  function save() {
    onSave({
      chargers: rows.map((r) => ({
        current: r.current,
        connector: r.connector,
        powerKw: number(r.powerKw),
        count: number(r.count),
        access: r.access,
        payments: r.payments,
        operator: r.operator.trim() || undefined,
        timeBased: r.timeBased,
        fees: r.fees.trim() || undefined,
      })),
    });
  }

  return (
    <Stack spacing={2}>
      {data.suggestions.length > 0 && (
        <Alert severity="info">
          Motoristas informaram recarga neste posto:{' '}
          {data.suggestions
            .map(
              (s) =>
                `${CHARGER_CURRENT_LABELS[s.current]} (${s.people} ${s.people === 1 ? 'pessoa' : 'pessoas'}${s.confirmed ? ', aparece no app' : ''})`,
            )
            .join('; ')}
          .{' '}
          {data.official
            ? 'Como o posto já cadastrou, vale o cadastro do posto.'
            : 'Ao cadastrar aqui, vale o cadastro do posto.'}
        </Alert>
      )}

      {rows.length === 0 && (
        <Typography color="text.secondary">
          {data.official
            ? 'O posto informou que não tem recarga elétrica.'
            : 'Nenhum ponto de recarga cadastrado.'}
        </Typography>
      )}

      {rows.map((row, i) => (
        <Paper key={i} variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              <TextField
                select
                size="small"
                label="Tipo"
                value={row.current}
                disabled={!canEdit}
                onChange={(e) =>
                  update(i, { current: e.target.value as Row['current'] })
                }
              >
                {CHARGER_CURRENTS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {CHARGER_CURRENT_LABELS[c]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Conector"
                value={row.connector}
                disabled={!canEdit}
                onChange={(e) =>
                  update(i, { connector: e.target.value as Row['connector'] })
                }
              >
                {CONNECTORS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {CONNECTOR_LABELS[c]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Potência"
                value={row.powerKw}
                disabled={!canEdit}
                error={row.powerKw !== '' && !(number(row.powerKw) > 0)}
                onChange={(e) => update(i, { powerKw: e.target.value })}
                slotProps={{
                  htmlInput: { inputMode: 'decimal' },
                  input: {
                    endAdornment: <InputAdornment position="end">kW</InputAdornment>,
                  },
                }}
              />
              <TextField
                size="small"
                label="Quantidade de pontos"
                value={row.count}
                disabled={!canEdit}
                onChange={(e) =>
                  update(i, { count: e.target.value.replace(/\D/g, '') })
                }
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              />
              <TextField
                select
                size="small"
                label="Acesso"
                value={row.access}
                disabled={!canEdit}
                onChange={(e) =>
                  update(i, { access: e.target.value as Row['access'] })
                }
              >
                {CHARGER_ACCESS.map((a) => (
                  <MenuItem key={a} value={a}>
                    {CHARGER_ACCESS_LABELS[a]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Operadora ou app (opcional)"
                placeholder="Ex.: Zletric"
                value={row.operator}
                disabled={!canEdit}
                onChange={(e) => update(i, { operator: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 60 } }}
                sx={{ gridColumn: { md: 'span 2' } }}
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Como pagar
              </Typography>
              <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap' }}>
                {CHARGER_PAYMENTS.map((p) => (
                  <FormControlLabel
                    key={p}
                    disabled={!canEdit}
                    control={
                      <Checkbox
                        checked={row.payments.includes(p)}
                        onChange={(_, checked) =>
                          update(i, {
                            payments: checked
                              ? [...row.payments, p]
                              : row.payments.filter((x) => x !== p),
                          })
                        }
                      />
                    }
                    label={CHARGER_PAYMENT_LABELS[p]}
                  />
                ))}
                <FormControlLabel
                  disabled={!canEdit}
                  control={
                    <Checkbox
                      checked={row.timeBased}
                      onChange={(_, checked) => update(i, { timeBased: checked })}
                    />
                  }
                  label="Cobra por tempo (não por kWh)"
                />
              </Stack>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <TextField
                size="small"
                fullWidth
                label="Taxas extras (opcional)"
                placeholder="Ex.: R$ 2,50 por recarga; R$ 1,00/min parado após 15 min"
                helperText="Aparecem como observação; não entram na comparação de preço."
                value={row.fees}
                disabled={!canEdit}
                onChange={(e) => update(i, { fees: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 140 } }}
              />
              {canEdit && (
                <IconButton
                  aria-label="Remover este ponto"
                  onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
                >
                  <DeleteOutlined />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Paper>
      ))}

      {error && <Alert severity="error">{error}</Alert>}

      {canEdit && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between' }}
        >
          <Button
            startIcon={<AddOutlined />}
            onClick={() => setRows((list) => [...list, emptyRow(list)])}
            disabled={rows.length >= 10}
          >
            Adicionar tipo de ponto
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || invalid}
          >
            {rows.length === 0 ? 'Salvar: o posto não tem recarga' : 'Salvar'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
