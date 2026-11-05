import { ORG_ROLE_LABELS, roleCan, type Me } from '@tankei/shared';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link, Navigate } from 'react-router';
import { useMyInvitations } from '../api/queries';
import { InvitationsBanner } from '../components/InvitationsBanner';
import { ClaimsPage } from './ClaimsPage';

/**
 * Início do portal (ADR 0021): convites pendentes primeiro; sem rede, os
 * pedidos de acesso; com uma rede, vai direto para ela (ou para a unidade);
 * com várias, a lista de redes.
 */
export function StationsPage({ user }: { user: Me }) {
  const invitations = useMyInvitations();
  const pending = invitations.data?.length ?? 0;
  const orgs = user.organizations;

  if (invitations.isPending) {
    return <Typography color="text.secondary">Carregando…</Typography>;
  }

  if (orgs.length === 0) {
    // Com convite pendente, ele é o caminho; pedir acesso fica como opção.
    if (pending > 0) {
      return (
        <Stack spacing={2}>
          <InvitationsBanner />
          <Box>
            <Button component={Link} to="/acesso">
              Ou peça acesso a outro posto
            </Button>
          </Box>
        </Stack>
      );
    }
    return <ClaimsPage user={user} />;
  }

  if (orgs.length === 1 && pending === 0) {
    const [org] = orgs;
    // Pelo que a pessoa enxerga (escopo), não pelo total da rede.
    const goToNetwork =
      org.stations.length > 1 || roleCan(org.role, 'manage_team');
    if (goToNetwork) return <Navigate to={`/redes/${org.id}`} replace />;
    if (org.stations[0]) {
      return <Navigate to={`/postos/${org.stations[0].id}/precos`} replace />;
    }
  }

  return (
    <Stack spacing={2}>
      <InvitationsBanner />
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        Suas redes
      </Typography>
      <Paper variant="outlined">
        <List disablePadding aria-label="Suas redes">
          {orgs.map((org, index) => (
            <ListItemButton
              key={org.id}
              component={Link}
              to={`/redes/${org.id}`}
              divider={index < orgs.length - 1}
              sx={{ py: 1.5 }}
            >
              <ListItemText
                primary={org.name}
                secondary={`${ORG_ROLE_LABELS[org.role]} · ${org.stations.length} ${org.stations.length === 1 ? 'unidade' : 'unidades'}`}
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
              <ChevronRight color="action" />
            </ListItemButton>
          ))}
        </List>
      </Paper>
      <Box>
        <Button component={Link} to="/acesso">
          Pedir acesso a outro posto
        </Button>
      </Box>
    </Stack>
  );
}
