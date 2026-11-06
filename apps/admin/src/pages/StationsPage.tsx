import Search from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Fragment } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStationSearch } from '../api/admin-queries';
import { useDebounced } from '../components/hooks';
import { PageHeader } from '../components/PageHeader';
import { ModeChip } from '../components/StationModeSection';

/** Busca de postos por CNPJ, nome ou cidade. A busca fica no endereço. */
export function StationsPage() {
  const [params, setParams] = useSearchParams();
  const text = params.get('q') ?? '';
  const q = useDebounced(text.trim());
  const search = useStationSearch(q);

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Postos"
        subtitle="Encontre um posto para ver a rede, os responsáveis verificados e vincular alguém."
      />
      <TextField
        placeholder="CNPJ, nome ou cidade"
        value={text}
        onChange={(event) =>
          setParams(event.target.value ? { q: event.target.value } : {}, {
            replace: true,
          })
        }
        autoFocus
        fullWidth
        slotProps={{
          htmlInput: { 'aria-label': 'Buscar posto' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          },
        }}
      />

      {search.isFetching && <LinearProgress aria-label="Buscando" />}
      {search.isError && <Alert severity="error">{search.error.message}</Alert>}
      {q.length < 2 && (
        <Typography color="text.secondary" variant="body2">
          Digite pelo menos 2 caracteres. CNPJ pode ser só o começo, com ou sem
          pontuação.
        </Typography>
      )}
      {q.length >= 2 && search.data?.length === 0 && (
        <Alert severity="info">Nenhum posto encontrado.</Alert>
      )}

      {q.length >= 2 && search.data && search.data.length > 0 && (
        <Paper variant="outlined">
          <List disablePadding>
            {search.data.map((s, index) => (
              <Fragment key={s.id}>
                {index > 0 && <Divider component="li" />}
                <ListItem disablePadding>
                  <ListItemButton
                    component={Link}
                    to={`/postos/${s.id}`}
                    sx={{ gap: 2, flexWrap: 'wrap', py: 1.25 }}
                  >
                    <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        CNPJ {s.cnpj} · {s.city}/{s.state} · {s.brand}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {s.mode !== 'normal' && <ModeChip mode={s.mode} />}
                      {!s.active && (
                        <Chip size="small" color="warning" label="Inativo" />
                      )}
                      <Chip
                        size="small"
                        variant="outlined"
                        color={s.network ? 'primary' : 'default'}
                        label={s.network ? s.network.name : 'Sem rede'}
                        sx={{ maxWidth: 220 }}
                      />
                    </Stack>
                  </ListItemButton>
                </ListItem>
              </Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  );
}
