import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {
  BRAZIL_STATES,
  CLAIM_POSITION_LABELS,
  CLAIM_POSITIONS,
  type ClaimableStation,
  type ClaimOrigin,
  type ClaimPosition,
  type Me,
} from '@tankei/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useClaimSearch, useCreateClaim } from '../api/queries';

/** Atraso da busca enquanto a pessoa digita. */
const SEARCH_DELAY_MS = 350;

/** Pedido de acesso em dois passos: achar o posto e informar o contato. */
export function ClaimForm({
  user,
  onCancel,
  onSent,
  initialStation = null,
  origin = 'portal',
}: {
  user: Me;
  onCancel: () => void;
  onSent: () => void;
  /** Posto já escolhido pelo link do app (ADR 0031): começa nos dados. */
  initialStation?: ClaimableStation | null;
  origin?: ClaimOrigin;
}) {
  const [station, setStation] = useState<ClaimableStation | null>(
    initialStation,
  );
  const [confirmed, setConfirmed] = useState(initialStation !== null);
  const step = confirmed && station ? 1 : 0;

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        Reivindicar posto
      </Typography>
      <Stepper activeStep={step} alternativeLabel>
        <Step>
          <StepLabel>Encontre o posto</StepLabel>
        </Step>
        <Step>
          <StepLabel>Seus dados</StepLabel>
        </Step>
      </Stepper>

      {step === 0 ? (
        <SearchStep
          station={station}
          onStation={setStation}
          onNext={() => setConfirmed(true)}
          onCancel={onCancel}
        />
      ) : (
        <ContactStep
          user={user}
          origin={origin}
          station={station!}
          onBack={() => setConfirmed(false)}
          onSent={onSent}
        />
      )}
    </Stack>
  );
}

function StationSummary({ station }: { station: ClaimableStation }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 700 }}>{station.name}</Typography>
      <Typography variant="body2" color="text.secondary">
        {station.legalName} · CNPJ {station.cnpj}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {station.brand} · {station.address} · {station.city}/{station.state}
      </Typography>
    </Paper>
  );
}

function SearchStep({
  station,
  onStation,
  onNext,
  onCancel,
}: {
  station: ClaimableStation | null;
  onStation: (station: ClaimableStation | null) => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const search = useClaimSearch(query, state);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const ready = query.trim().length >= 3;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Autocomplete
          sx={{ flex: 2 }}
          options={ready ? (search.data ?? []) : []}
          value={station}
          onChange={(_, value) => onStation(value)}
          inputValue={input}
          onInputChange={(_, value) => setInput(value)}
          // A filtragem é feita pela API (CNPJ ou nome, sem acento).
          filterOptions={(options) => options}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          loading={ready && search.isFetching}
          noOptionsText={
            ready
              ? 'Nenhum posto encontrado. Confira o CNPJ (está na nota fiscal) ou tente parte do nome.'
              : 'Digite pelo menos 3 caracteres'
          }
          loadingText="Buscando…"
          renderOption={({ key, ...props }, option) => (
            <li key={key} {...props}>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{option.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {option.legalName} · CNPJ {option.cnpj}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {option.brand} · {option.city}/{option.state}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              label="CNPJ ou nome do posto"
              placeholder="00.000.000/0000-00 ou Posto Exemplo"
            />
          )}
        />
        <TextField
          select
          label="Estado (busca por nome)"
          value={state}
          onChange={(event) => setState(event.target.value)}
          sx={{ flex: 1 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {BRAZIL_STATES.map((s) => (
            <MenuItem key={s.code} value={s.code}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {search.isError && <Alert severity="error">{search.error.message}</Alert>}
      {station && <StationSummary station={station} />}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="contained" disabled={!station} onClick={onNext}>
          Continuar
        </Button>
      </Stack>
    </Stack>
  );
}

function ContactStep({
  user,
  origin,
  station,
  onBack,
  onSent,
}: {
  user: Me;
  origin: ClaimOrigin;
  station: ClaimableStation;
  onBack: () => void;
  onSent: () => void;
}) {
  const create = useCreateClaim();
  const [contactName, setContactName] = useState(user.name ?? '');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState<ClaimPosition | null>(null);
  const [message, setMessage] = useState('');

  const phoneDigits = phone.replace(/\D/g, '');
  const phoneOk = phoneDigits.length === 10 || phoneDigits.length === 11;
  const valid = contactName.trim().length >= 3 && phoneOk && position !== null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || !position) return;
    create.mutate(
      {
        stationId: station.id,
        contactName: contactName.trim(),
        phone,
        position,
        message: message.trim() || undefined,
        origin,
      },
      { onSuccess: onSent },
    );
  }

  return (
    <Stack component="form" spacing={2} onSubmit={submit}>
      <StationSummary station={station} />

      <TextField
        label="Seu nome"
        autoComplete="name"
        value={contactName}
        onChange={(event) => setContactName(event.target.value)}
        fullWidth
      />
      <TextField
        label="Telefone com DDD"
        type="tel"
        placeholder="(49) 99999-9999"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={phone.trim() !== '' && !phoneOk}
        helperText="A equipe Tankei liga nesse número para confirmar que você responde pelo posto. O telefone não aparece para mais ninguém."
        fullWidth
        slotProps={{ htmlInput: { inputMode: 'tel', autoComplete: 'tel' } }}
      />
      <Box>
        <Typography
          id="claim-position"
          variant="body2"
          color="text.secondary"
          sx={{ mb: 0.75 }}
        >
          Seu cargo no posto
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          color="primary"
          value={position}
          onChange={(_, value: ClaimPosition | null) =>
            value && setPosition(value)
          }
          aria-labelledby="claim-position"
        >
          {CLAIM_POSITIONS.map((p) => (
            <ToggleButton key={p} value={p}>
              {CLAIM_POSITION_LABELS[p]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <TextField
        label="Observação (opcional)"
        placeholder="Melhor horário para ligar, por exemplo"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        multiline
        minRows={2}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />

      {create.error && (
        <Alert severity="error">
          {create.error instanceof ApiError
            ? create.error.message
            : 'Não foi possível enviar. Tente de novo.'}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onBack}>Voltar</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!valid || create.isPending}
        >
          {create.isPending ? 'Enviando…' : 'Enviar pedido'}
        </Button>
      </Stack>
    </Stack>
  );
}
