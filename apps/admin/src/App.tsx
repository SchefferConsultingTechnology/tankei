import GavelOutlined from '@mui/icons-material/GavelOutlined';
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import HubOutlined from '@mui/icons-material/HubOutlined';
import LocalGasStationOutlined from '@mui/icons-material/LocalGasStationOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { NavItem } from './components/NavItem';
import { PageLoading } from './components/PageLoading';
import { ClaimsQueuePage } from './pages/ClaimsQueuePage';
import { LoginPage } from './pages/LoginPage';

// Cada tela é carregada quando aberta (ADR 0022).
const StationsPage = lazy(() =>
  import('./pages/StationsPage').then((m) => ({ default: m.StationsPage })),
);
const StationDetailPage = lazy(() =>
  import('./pages/StationDetailPage').then((m) => ({
    default: m.StationDetailPage,
  })),
);
const NetworksPage = lazy(() =>
  import('./pages/NetworksPage').then((m) => ({ default: m.NetworksPage })),
);
const NetworkDetailPage = lazy(() =>
  import('./pages/NetworkDetailPage').then((m) => ({
    default: m.NetworkDetailPage,
  })),
);
const ModerationPage = lazy(() =>
  import('./pages/ModerationPage').then((m) => ({
    default: m.ModerationPage,
  })),
);
const MediaPage = lazy(() =>
  import('./pages/MediaPage').then((m) => ({ default: m.MediaPage })),
);
const ParametersPage = lazy(() =>
  import('./pages/ParametersPage').then((m) => ({
    default: m.ParametersPage,
  })),
);

/** Menu da administração. */
const sidebar = (
  <>
    <List dense subheader={<ListSubheader>Conteúdo</ListSubheader>}>
      <NavItem
        to="/moderacao"
        label="Moderação"
        icon={<GavelOutlined fontSize="small" />}
      />
      <NavItem
        to="/imagens"
        label="Imagens"
        icon={<PhotoLibraryOutlined fontSize="small" />}
      />
    </List>
    <List dense subheader={<ListSubheader>Postos</ListSubheader>}>
      <NavItem
        to="/"
        end
        label="Pedidos de acesso"
        icon={<HowToRegOutlined fontSize="small" />}
      />
      <NavItem
        to="/postos"
        label="Postos"
        icon={<LocalGasStationOutlined fontSize="small" />}
      />
      <NavItem
        to="/redes"
        label="Redes"
        icon={<HubOutlined fontSize="small" />}
      />
    </List>
    <List dense subheader={<ListSubheader>Sistema</ListSubheader>}>
      <NavItem
        to="/parametros"
        label="Parâmetros"
        icon={<TuneOutlined fontSize="small" />}
      />
    </List>
  </>
);

/** Só administradores (ADR 0007); a API também recusa os demais. */
export function App() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <Layout>
        <PageLoading />
      </Layout>
    );
  }
  if (state.status === 'signedOut') {
    return (
      <Layout>
        <LoginPage />
      </Layout>
    );
  }
  if (state.user.role !== 'admin') {
    return (
      <Layout>
        <Alert
          severity="warning"
          icon={<LockOutlined />}
          sx={{ maxWidth: 520, mx: 'auto', mt: 4 }}
        >
          <AlertTitle>Acesso restrito</AlertTitle>
          Esta área é da equipe Tankei. A conta
          {state.user.email ? ` ${state.user.email}` : ''} não é de
          administrador.
        </Alert>
      </Layout>
    );
  }
  return (
    <Layout sidebar={sidebar}>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<ClaimsQueuePage />} />
          <Route path="/postos" element={<StationsPage />} />
          <Route path="/postos/:stationId" element={<StationDetailPage />} />
          <Route path="/redes" element={<NetworksPage />} />
          <Route path="/redes/:networkId" element={<NetworkDetailPage />} />
          <Route path="/parametros" element={<ParametersPage />} />
          <Route path="/moderacao" element={<ModerationPage />} />
          <Route path="/imagens" element={<MediaPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
