import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { PageLoading } from './components/PageLoading';
import { PortalShell } from './pages/PortalShell';
import { useCan, useStationContext } from './pages/station-context';

/**
 * Cada tela é carregada só quando é aberta: o celular baixa menos na
 * entrada. A moldura (cabeçalho e menu) fica no pacote principal.
 */
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const StationsPage = lazy(() =>
  import('./pages/StationsPage').then((m) => ({ default: m.StationsPage })),
);
const ClaimsPage = lazy(() =>
  import('./pages/ClaimsPage').then((m) => ({ default: m.ClaimsPage })),
);
const NetworkOverviewPage = lazy(() =>
  import('./pages/NetworkOverviewPage').then((m) => ({
    default: m.NetworkOverviewPage,
  })),
);
const TeamPage = lazy(() =>
  import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })),
);
const PricesTab = lazy(() =>
  import('./pages/PricesTab').then((m) => ({ default: m.PricesTab })),
);
const PriceHistoryPage = lazy(() =>
  import('./pages/PriceHistoryPage').then((m) => ({
    default: m.PriceHistoryPage,
  })),
);
const AgreementsPage = lazy(() =>
  import('./pages/AgreementsPage').then((m) => ({
    default: m.AgreementsPage,
  })),
);
const ContestsPage = lazy(() =>
  import('./pages/ContestsPage').then((m) => ({ default: m.ContestsPage })),
);
const PromotionsPage = lazy(() =>
  import('./pages/PromotionsPage').then((m) => ({
    default: m.PromotionsPage,
  })),
);
const PhotosPage = lazy(() =>
  import('./pages/PhotosPage').then((m) => ({ default: m.PhotosPage })),
);
const CompetitionTab = lazy(() =>
  import('./pages/CompetitionTab').then((m) => ({ default: m.CompetitionTab })),
);
const CitiesPage = lazy(() =>
  import('./pages/CitiesPage').then((m) => ({ default: m.CitiesPage })),
);
const CompetitorPromotionsPage = lazy(() =>
  import('./pages/CompetitorPromotionsPage').then((m) => ({
    default: m.CompetitorPromotionsPage,
  })),
);
const StationInfoPage = lazy(() =>
  import('./pages/StationInfoPage').then((m) => ({
    default: m.StationInfoPage,
  })),
);
const ChargingPage = lazy(() =>
  import('./pages/ChargingPage').then((m) => ({ default: m.ChargingPage })),
);
const VisitsPage = lazy(() =>
  import('./pages/VisitsPage').then((m) => ({ default: m.VisitsPage })),
);
const ReputationTab = lazy(() =>
  import('./pages/ReputationTab').then((m) => ({ default: m.ReputationTab })),
);

/** Telas que recebem o posto da moldura (StationShell). */
function PricesRoute() {
  const { station } = useStationContext();
  return (
    <PricesTab
      station={station}
      canUpdate={useCan('update_price')}
      canContest={useCan('contest')}
    />
  );
}
function RegionRoute() {
  const { station } = useStationContext();
  return <CompetitionTab stationId={station.id} />;
}
function ReputationRoute() {
  const { station } = useStationContext();
  return <ReputationTab stationId={station.id} />;
}

/** Endereço antigo (?aba=) para o novo, por tela. */
function LegacyStationRedirect() {
  const { id } = useParams();
  return <Navigate to={`/postos/${id}/precos`} replace />;
}

/** Sem login, todas as rotas mostram a entrada. */
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
        <Suspense fallback={<PageLoading />}>
          <LoginPage />
        </Suspense>
      </Layout>
    );
  }
  const user = state.user;
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout>
            <Suspense fallback={<PageLoading />}>
              <StationsPage user={user} />
            </Suspense>
          </Layout>
        }
      />
      <Route
        path="/acesso"
        element={
          <Layout>
            <Suspense fallback={<PageLoading />}>
              <ClaimsPage user={user} />
            </Suspense>
          </Layout>
        }
      />
      <Route path="/redes/:orgId" element={<PortalShell user={user} />}>
        <Route index element={<NetworkOverviewPage />} />
        <Route path="equipe" element={<TeamPage />} />
      </Route>
      <Route path="/postos/:id" element={<PortalShell user={user} />}>
        <Route index element={<LegacyStationRedirect />} />
        <Route path="precos" element={<PricesRoute />} />
        <Route path="precos/historico" element={<PriceHistoryPage />} />
        <Route path="precos/contestacoes" element={<ContestsPage />} />
        <Route path="precos/convenios" element={<AgreementsPage />} />
        <Route path="posto/horario" element={<StationInfoPage />} />
        <Route path="posto/recarga" element={<ChargingPage />} />
        <Route path="posto/visitas" element={<VisitsPage />} />
        <Route path="divulgacao/promocoes" element={<PromotionsPage />} />
        <Route path="divulgacao/fotos" element={<PhotosPage />} />
        <Route path="concorrencia" element={<RegionRoute />} />
        <Route path="concorrencia/cidades" element={<CitiesPage />} />
        <Route
          path="concorrencia/promocoes"
          element={<CompetitorPromotionsPage />}
        />
        <Route path="reputacao" element={<ReputationRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
