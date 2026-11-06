import Search from '@mui/icons-material/Search';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
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
import { useNetworks } from '../api/admin-queries';
import { useDebounced } from '../components/hooks';
import { PageHeader } from '../components/PageHeader';
import { PageLoading } from '../components/PageLoading';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Redes de postos (ADR 0021), por nome ou e-mail de alguém da equipe. */
export function NetworksPage() {
  const [params, setParams] = useSearchParams();
  const text = params.get('q') ?? '';
  const networks = useNetworks(useDebounced(text.trim()));

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Redes"
        subtitle="Unidades, equipe, convites e o registro de cada rede."
      />
      <TextField
        placeholder="Nome da rede ou e-mail de alguém da equipe"
        value={text}
        onChange={(event) =>
          setParams(event.target.value ? { q: event.target.value } : {}, {
            replace: true,
          })
        }
        fullWidth
        slotProps={{
          htmlInput: { 'aria-label': 'Buscar rede' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          },
        }}
      />

      {networks.isPending && <PageLoading />}
      {networks.isFetching && !networks.isPending && (
        <LinearProgress aria-label="Buscando" />
      )}
      {networks.isError && (
        <Alert severity="error">{networks.error.message}</Alert>
      )}
      {networks.data?.length === 0 && (
        <Alert severity="info">
          {text ? 'Nenhuma rede encontrada.' : 'Ainda não há redes.'}
        </Alert>
      )}

      {networks.data && networks.data.length > 0 && (
        <Paper variant="outlined">
          <List disablePadding>
            {networks.data.map((n, index) => (
              <Fragment key={n.id}>
                {index > 0 && <Divider component="li" />}
                <ListItem disablePadding>
                  <ListItemButton
                    component={Link}
                    to={`/redes/${n.id}`}
                    sx={{ gap: 2, flexWrap: 'wrap', py: 1.25 }}
                  >
                    <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>{n.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {plural(n.stations, 'unidade', 'unidades')} ·{' '}
                        {plural(n.members, 'pessoa', 'pessoas')}
                        {n.owners.length > 0 &&
                          ` · Proprietário: ${n.owners.join(', ')}`}
                      </Typography>
                    </Box>
                    {n.owners.length === 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        icon={<WarningAmberOutlined />}
                        label="Sem proprietário"
                      />
                    )}
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
