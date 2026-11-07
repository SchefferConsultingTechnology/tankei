import AddOutlined from '@mui/icons-material/AddOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  DAY_MODE_LABELS,
  DAY_MODES,
  DAY_TYPE_LABELS,
  DAY_TYPES,
  describeDay,
  openingHoursSchema,
  openingStatus,
  STATION_SERVICE_LABELS,
  STATION_SERVICES,
  type DayMode,
  type DaySchedule,
  type DayType,
  type OpeningHours,
  type StationInfo,
  type StationService,
  type UpdateStationInfo,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';

const DEFAULT_HOURS: OpeningHours = {
  dias_uteis: { mode: 'horario', intervals: [{ open: '06:00', close: '22:00' }] },
  sabado: { mode: 'horario', intervals: [{ open: '07:00', close: '20:00' }] },
  domingo: { mode: 'horario', intervals: [{ open: '08:00', close: '18:00' }] },
  feriado: { mode: 'horario', intervals: [{ open: '08:00', close: '18:00' }] },
};

const SERVICE_HINTS: Record<StationService, string> = {
  calibrador: 'Calibrador de pneus disponível para os clientes.',
  borracharia:
    'Conserto de pneus no posto ou anexo a ele. Ajuda quem está com pneu furado, principalmente na estrada.',
};

/**
 * Horário de atendimento e serviços do posto (ADR 0033): quatro tipos de dia,
 * cada um fechado, 24 horas ou com até dois intervalos (podem passar da
 * meia-noite). Mostra como o app vai exibir "aberto agora".
 */
export function StationInfoEditor({
  info,
  state,
  canEdit,
  saving,
  error,
  onSave,
}: {
  info: StationInfo;
  /** UF do posto, para o "aberto agora" na hora local. */
  state: string;
  canEdit: boolean;
  saving: boolean;
  error: string | null;
  onSave: (body: UpdateStationInfo) => void;
}) {
  const [informHours, setInformHours] = useState(info.hours !== null);
  const [hours, setHours] = useState<OpeningHours>(info.hours ?? DEFAULT_HOURS);
  const [services, setServices] = useState<StationService[]>(info.services);
  const [name, setName] = useState(info.displayName ?? '');
  const nameTrim = name.trim();
  const nameValid = nameTrim === '' || nameTrim.length >= 3;

  const parsed = openingHoursSchema.safeParse(hours);
  const valid = (!informHours || parsed.success) && nameValid;
  const status =
    informHours && parsed.success ? openingStatus(parsed.data, state) : null;

  const setDay = (day: DayType, schedule: DaySchedule) =>
    setHours((h) => ({ ...h, [day]: schedule }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSave({
      displayName: nameTrim || null,
      hours: informHours && parsed.success ? parsed.data : null,
      services: STATION_SERVICES.filter((s) => services.includes(s)),
    });
  }

  return (
    <Stack component="form" spacing={2.5} onSubmit={submit}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography sx={{ fontWeight: 700 }}>Nome no app</Typography>
          <TextField
            label="Nome como o posto é conhecido"
            placeholder={info.officialName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            error={!nameValid}
            helperText={
              !nameValid
                ? 'Use pelo menos 3 caracteres.'
                : `Em branco, o app mostra o nome do cadastro da ANP: ${info.officialName}.`
            }
            fullWidth
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              Horário de atendimento
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={informHours}
                  onChange={(e) => setInformHours(e.target.checked)}
                  disabled={!canEdit}
                />
              }
              label="Informar"
              labelPlacement="start"
            />
          </Stack>
          {!informHours ? (
            <Typography variant="body2" color="text.secondary">
              Sem horário informado, o app não mostra se o posto está aberto.
            </Typography>
          ) : (
            <>
              {DAY_TYPES.map((day) => (
                <DayRow
                  key={day}
                  day={day}
                  schedule={hours[day]}
                  disabled={!canEdit}
                  onChange={(schedule) => setDay(day, schedule)}
                />
              ))}
              <Typography variant="body2" color="text.secondary">
                Feriados: os nacionais (inclusive a Sexta-feira Santa).
                Horário que termina antes de começar passa da meia-noite (ex.:
                18:00 às 02:00).
              </Typography>
              {!parsed.success && (
                <Alert severity="warning">
                  {parsed.error.issues[0]?.message ?? 'Confira os horários.'}
                </Alert>
              )}
              {status && (
                <Alert severity={status.open ? 'success' : 'info'}>
                  No app, agora: <strong>{status.label}</strong>
                </Alert>
              )}
            </>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Serviços</Typography>
        <FormGroup>
          {STATION_SERVICES.map((service) => (
            <Box key={service} sx={{ mb: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={services.includes(service)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setServices((list) =>
                        e.target.checked
                          ? [...list, service]
                          : list.filter((s) => s !== service),
                      )
                    }
                  />
                }
                label={STATION_SERVICE_LABELS[service]}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ ml: 4, mt: -0.5 }}
              >
                {SERVICE_HINTS[service]}
              </Typography>
            </Box>
          ))}
        </FormGroup>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {canEdit && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" disabled={!valid || saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function DayRow({
  day,
  schedule,
  disabled,
  onChange,
}: {
  day: DayType;
  schedule: DaySchedule;
  disabled: boolean;
  onChange: (schedule: DaySchedule) => void;
}) {
  const setMode = (mode: DayMode) =>
    onChange({
      mode,
      intervals:
        mode === 'horario'
          ? schedule.intervals.length > 0
            ? schedule.intervals
            : [{ open: '06:00', close: '22:00' }]
          : [],
    });
  const setInterval = (index: number, field: 'open' | 'close', value: string) =>
    onChange({
      ...schedule,
      intervals: schedule.intervals.map((i, n) =>
        n === index ? { ...i, [field]: value } : i,
      ),
    });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          sm: '150px minmax(0, 1fr)',
        },
        gap: 1,
        alignItems: 'start',
      }}
    >
      <Typography sx={{ fontWeight: 600, pt: { sm: 1 } }}>
        {DAY_TYPE_LABELS[day]}
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          sx={{ display: 'block', fontWeight: 400 }}
        >
          {describeDay(schedule)}
        </Typography>
      </Typography>
      <Stack spacing={1}>
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={schedule.mode}
          onChange={(_, value: DayMode | null) => value && setMode(value)}
          disabled={disabled}
          aria-label={`Modo: ${DAY_TYPE_LABELS[day]}`}
        >
          {DAY_MODES.map((mode) => (
            <ToggleButton key={mode} value={mode}>
              {DAY_MODE_LABELS[mode]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {schedule.mode === 'horario' &&
          schedule.intervals.map((interval, index) => (
            <Stack
              key={index}
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center' }}
            >
              <TextField
                type="time"
                size="small"
                label="Abre"
                value={interval.open}
                disabled={disabled}
                onChange={(e) => setInterval(index, 'open', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1, minWidth: 0, maxWidth: 160 }}
              />
              <Typography color="text.secondary">às</Typography>
              <TextField
                type="time"
                size="small"
                label="Fecha"
                value={interval.close}
                disabled={disabled}
                onChange={(e) => setInterval(index, 'close', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1, minWidth: 0, maxWidth: 160 }}
              />
              {index === 1 && !disabled && (
                <Tooltip title="Tirar o segundo intervalo">
                  <IconButton
                    sx={{ flexShrink: 0 }}
                    aria-label="Tirar o segundo intervalo"
                    onClick={() =>
                      onChange({
                        ...schedule,
                        intervals: schedule.intervals.slice(0, 1),
                      })
                    }
                  >
                    <CloseOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          ))}
        {schedule.mode === 'horario' &&
          schedule.intervals.length === 1 &&
          !disabled && (
            <Button
              size="small"
              startIcon={<AddOutlined />}
              sx={{ alignSelf: 'flex-start' }}
              onClick={() =>
                // Divide o horário em dois, com pausa para o almoço.
                onChange({
                  ...schedule,
                  intervals: [
                    { open: schedule.intervals[0].open, close: '12:00' },
                    { open: '13:30', close: schedule.intervals[0].close },
                  ],
                })
              }
            >
              Segundo intervalo (ex.: fecha no almoço)
            </Button>
          )}
      </Stack>
    </Box>
  );
}
