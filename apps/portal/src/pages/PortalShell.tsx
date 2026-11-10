import { ORG_ROLE_LABELS, roleCan, type Me } from '@tankei/shared';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import GavelOutlined from '@mui/icons-material/GavelOutlined';
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import EvStationOutlined from '@mui/icons-material/EvStationOutlined';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import LocalGasStationOutlined from '@mui/icons-material/LocalGasStationOutlined';
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined';
import LocationCityOutlined from '@mui/icons-material/LocationCityOutlined';
import NearMeOutlined from '@mui/icons-material/NearMeOutlined';
import StarBorderOutlined from '@mui/icons-material/StarBorderOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Suspense, type ReactNode } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
import { useStation } from '../api/queries';
import { Layout } from '../components/Layout';
import { ClaimNotices } from '../components/ClaimNotices';
import { NavItem } from '../components/NavItem';
import { PageLoading } from '../components/PageLoading';
import type { PortalContext } from './station-context';

/** Telas de uma unidade, na ordem do menu (o caminho é relativo a /postos/:id). */
const UNIT_MENU: {
  label: string;
  items: { label: string; to: string; end?: boolean; icon: ReactNode }[];
}[] = [
  {
    label: 'Preços',
    items: [
      {
        label: 'Preços atuais',
        to: 'precos',
        end: true,
        icon: <LocalGasStationOutlined fontSize="small" />,
      },
      {
        label: 'Histórico',
        to: 'precos/historico',
        icon: <HistoryOutlined fontSize="small" />,
      },
      {
        label: 'Contestações',
        to: 'precos/contestacoes',
        icon: <GavelOutlined fontSize="small" />,
      },
      {
        label: 'Convênios',
        to: 'precos/convenios',
        icon: <HandshakeOutlined fontSize="small" />,
      },
    ],
  },
  {
    label: 'Posto',
    items: [
      {
        label: 'Dados do posto',
        to: 'posto/horario',
        icon: <ScheduleOutlined fontSize="small" />,
      },
      {
        label: 'Recarga elétrica',
        to: 'posto/recarga',
        icon: <EvStationOutlined fontSize="small" />,
      },
      {
        label: 'Visitas',
        to: 'posto/visitas',
        icon: <InsightsOutlined fontSize="small" />,
      },
    ],
  },
  {
    label: 'Divulgação',
    items: [
      {
        label: 'Minhas promoções',
        to: 'divulgacao/promocoes',
        icon: <CampaignOutlined fontSize="small" />,
      },
      {
        label: 'Fotos do posto',
        to: 'divulgacao/fotos',
        icon: <PhotoLibraryOutlined fontSize="small" />,
      },
    ],
  },
  {
    label: 'Concorrência',
    items: [
      {
        label: 'Região',
        to: 'concorrencia',
        end: true,
        icon: <NearMeOutlined fontSize="small" />,
      },
      {
        label: 'Outras cidades',
        to: 'concorrencia/cidades',
        icon: <LocationCityOutlined fontSize="small" />,
      },
      {
        label: 'Promoções',
        to: 'concorrencia/promocoes',
        icon: <LocalOfferOutlined fontSize="small" />,
      },
    ],
  },
  {
    label: 'Reputação',
    items: [
      {
        label: 'IQP por dimensão',
        to: 'reputacao',
        icon: <StarBorderOutlined fontSize="small" />,
      },
    ],
  },
];

/**
 * Moldura do portal (ADR 0021): menu com a rede (visão geral, equipe) e a
 * unidade escolhida (preços, concorrência, reputação). Serve tanto
 * /redes/:orgId quanto /postos/:id.
 */
export function PortalShell({ user }: { user: Me }) {
  const { id: stationId, orgId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const station = useStation(stationId ?? '');

  const access = stationId
    ? user.managedStations.find((s) => s.id === stationId)
    : undefined;
  const org = user.organizations.find(
    (o) => o.id === (orgId ?? access?.organizationId),
  );

  // Sem acesso à unidade ou à rede pedida: volta ao início.
  if (!org || (stationId && !access)) return <Navigate to="/" replace />;
  const role = access?.role ?? org.role;
  const currentUnit = stationId ?? org.stations[0]?.id;
  // Pelo que a pessoa enxerga (escopo), não pelo total da rede.
  const showNetwork =
    org.stations.length > 1 || roleCan(org.role, 'manage_team');
  // Na tela da rede, os itens da unidade só aparecem depois de escolher uma.
  const showUnitMenu = Boolean(stationId) || org.stations.length === 1;

  /** Troca de unidade mantendo a tela (ex.: histórico da outra unidade). */
  function switchUnit(next: string) {
    const rest = stationId
      ? (location.pathname.split(`/postos/${stationId}/`)[1] ?? 'precos')
      : 'precos';
    navigate(`/postos/${next}/${rest}`);
  }

  const sidebar = (
    <>
      <Box sx={{ px: 2, pb: 1.5 }}>
        <Typography
          variant="subtitle1"
          noWrap
          title={org.name}
          sx={{ fontWeight: 700 }}
        >
          {org.name}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mt: 0.5 }}
        >
          <Chip label={ORG_ROLE_LABELS[org.role]} size="small" />
          {user.organizations.length > 1 && (
            <Button
              component={Link}
              to="/"
              size="small"
              startIcon={<SwapHorizOutlined />}
            >
              Trocar de rede
            </Button>
          )}
        </Stack>
      </Box>
      <Divider />

      {showNetwork && (
        <List dense subheader={<ListSubheader>Rede</ListSubheader>}>
          <NavItem
            to={`/redes/${org.id}`}
            end
            label="Visão geral"
            icon={<DashboardOutlined fontSize="small" />}
          />
          {roleCan(org.role, 'manage_team') && (
            <NavItem
              to={`/redes/${org.id}/equipe`}
              label="Equipe"
              icon={<GroupOutlined fontSize="small" />}
            />
          )}
        </List>
      )}

      {currentUnit && (
        <List dense subheader={<ListSubheader>Unidade</ListSubheader>}>
          <Box sx={{ px: 2, pt: 0.5 }}>
            {org.stations.length > 1 ? (
              <TextField
                select
                fullWidth
                size="small"
                label="Unidade"
                value={stationId ?? ''}
                onChange={(event) => switchUnit(event.target.value)}
                slotProps={{
                  select: {
                    displayEmpty: true,
                    renderValue: (value) =>
                      value
                        ? (org.stations.find((s) => s.id === value)?.name ?? '')
                        : 'Escolha a unidade',
                  },
                  inputLabel: { shrink: true },
                }}
              >
                {org.stations.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <StorefrontOutlined fontSize="small" color="action" />
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {org.stations[0]?.name}
                </Typography>
              </Stack>
            )}
          </Box>
        </List>
      )}

      {currentUnit &&
        showUnitMenu &&
        UNIT_MENU.map((group) => (
          <List
            key={group.label}
            dense
            subheader={<ListSubheader>{group.label}</ListSubheader>}
          >
            {group.items.map((item) => (
              <NavItem
                key={item.to}
                to={`/postos/${currentUnit}/${item.to}`}
                end={item.end}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </List>
        ))}

      <Box sx={{ flex: 1 }} />
      <Divider />
      <List dense>
        <NavItem
          to="/acesso"
          label="Pedidos de acesso"
          icon={<HowToRegOutlined fontSize="small" />}
        />
      </List>
    </>
  );

  const context: PortalContext = {
    org,
    role,
    station: stationId ? (station.data ?? null) : null,
  };

  return (
    <Layout sidebar={sidebar}>
      {stationId && station.isPending && (
        <PageLoading />
      )}
      {stationId && station.isError && (
        <Alert severity="error">{station.error.message}</Alert>
      )}
      {stationId && station.data && (
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {station.data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {station.data.brand} ·{' '}
            {[
              station.data.address,
              station.data.district,
              `${station.data.city}/${station.data.state}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>
      )}
      {stationId && station.data && roleCan(role, 'manage_team') && (
        <ClaimNotices stationId={stationId} />
      )}
      {(!stationId || station.data) && (
        <Suspense fallback={<PageLoading />}>
          <Outlet context={context} />
        </Suspense>
      )}
    </Layout>
  );
}
