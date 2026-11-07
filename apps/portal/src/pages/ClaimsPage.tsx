import AddBusinessOutlined from '@mui/icons-material/AddBusinessOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import {
  CLAIM_ORIGINS,
  CLAIM_POSITION_LABELS,
  CLAIM_STATUS_LABELS,
  type Claim,
  type ClaimOrigin,
  type Me,
} from '@tankei/shared';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useClaimStation, useMyClaims } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { ClaimForm } from './ClaimForm';

const STATUS_COLOR: Record<Claim['status'], 'warning' | 'success' | 'error'> = {
  em_analise: 'warning',
  aprovado: 'success',
  recusado: 'error',
};

/**
 * Pedidos de posto da pessoa e o formulário para pedir um novo (ADR 0019).
 * É a tela inicial de quem ainda não gerencia nenhum posto.
 */
export function ClaimsPage({ user }: { user: Me }) {
  const claims = useMyClaims();
  const { refreshUser } = useAuth();
  const [creating, setCreating] = useState(false);
  const [sent, setSent] = useState(false);
  // Link do app (ADR 0031): /acesso?posto=<id>&origem=app_dono.
  const [params, setParams] = useSearchParams();
  const linkedId = params.get('posto');
  const linkedOrigin = params.get('origem');
  const origin: ClaimOrigin = CLAIM_ORIGINS.includes(
    linkedOrigin as ClaimOrigin,
  )
    ? (linkedOrigin as ClaimOrigin)
    : 'portal';
  const linked = useClaimStation(linkedId);
  const clearLink = () => setParams({}, { replace: true });
  const managed = new Set(user.managedStations.map((s) => s.id));

  // Pedido aprovado depois do login: recarrega a conta para o posto aparecer.
  const approvedNotLoaded = claims.data?.some(
    (c) => c.status === 'aprovado' && !managed.has(c.station.id),
  );
  useEffect(() => {
    if (approvedNotLoaded) void refreshUser().catch(() => undefined);
  }, [approvedNotLoaded, refreshUser]);

  if (linkedId) {
    if (linked.isPending) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Carregando o posto" />
        </Box>
      );
    }
    const alreadyManaged = managed.has(linkedId);
    if (linked.isError || alreadyManaged) {
      return (
        <Alert
          severity={alreadyManaged ? 'info' : 'error'}
          action={<Button onClick={clearLink}>Continuar</Button>}
        >
          {alreadyManaged
            ? 'Você já gerencia este posto.'
            : 'Não encontramos o posto do link. Procure pelo CNPJ ou pelo nome.'}
        </Alert>
      );
    }
    return (
      <ClaimForm
        user={user}
        initialStation={linked.data}
        origin={origin}
        onCancel={clearLink}
        onSent={() => {
          clearLink();
          setSent(true);
        }}
      />
    );
  }

  if (creating) {
    return (
      <ClaimForm
        user={user}
        onCancel={() => setCreating(false)}
        onSent={() => {
          setCreating(false);
          setSent(true);
        }}
      />
    );
  }

  const first = user.name?.split(' ')[0];
  const list = claims.data ?? [];
  const noAccess = user.managedStations.length === 0;

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        {noAccess ? `Olá${first ? `, ${first}` : ''}!` : 'Pedidos de acesso'}
      </Typography>

      {sent && (
        <Alert severity="success" onClose={() => setSent(false)}>
          Pedido enviado. A equipe Tankei vai ligar para confirmar que você
          responde pelo posto; depois disso, o acesso é liberado aqui.
        </Alert>
      )}

      {noAccess && list.length === 0 && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 600 }}>
            Para usar o portal, peça acesso ao posto que você administra.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Você encontra o posto pelo CNPJ ou pelo nome. A equipe Tankei
            confirma por telefone que você responde por ele e libera o acesso.
          </Typography>
        </Paper>
      )}

      {claims.isError && <Alert severity="error">{claims.error.message}</Alert>}

      {list.length > 0 && (
        <Paper variant="outlined">
          <List disablePadding aria-label="Seus pedidos">
            {list.map((claim, index) => (
              <ListItem
                key={claim.id}
                divider={index < list.length - 1}
                sx={{ gap: 1.5, alignItems: 'flex-start', py: 1.5 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 600 }}>
                    {claim.station.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    CNPJ {claim.station.cnpj} · {claim.station.city}/
                    {claim.station.state}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {CLAIM_POSITION_LABELS[claim.position]} · pedido em{' '}
                    {new Date(claim.createdAt).toLocaleDateString('pt-BR')}
                  </Typography>
                  {claim.status === 'recusado' && claim.reason && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Motivo: {claim.reason}
                    </Typography>
                  )}
                  {claim.status === 'aprovado' &&
                    managed.has(claim.station.id) && (
                      <Button
                        component={Link}
                        to={`/postos/${claim.station.id}`}
                        size="small"
                        sx={{ mt: 0.5, ml: -1 }}
                      >
                        Abrir o posto
                      </Button>
                    )}
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={STATUS_COLOR[claim.status]}
                  label={CLAIM_STATUS_LABELS[claim.status]}
                  sx={{ flexShrink: 0 }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Box>
        <Button
          variant="contained"
          startIcon={<AddBusinessOutlined />}
          onClick={() => {
            setCreating(true);
            setSent(false);
          }}
        >
          {noAccess && list.length === 0
            ? 'Reivindicar meu posto'
            : 'Pedir acesso a outro posto'}
        </Button>
      </Box>

      {!noAccess && (
        <Box>
          <Button component={Link} to="/">
            Voltar aos meus postos
          </Button>
        </Box>
      )}
    </Stack>
  );
}
