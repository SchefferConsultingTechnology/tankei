import { Navigate, Route, Routes, useParams } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { CitiesPage } from './pages/CitiesPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { CompetitionTab } from './pages/CompetitionTab';
import { CompetitorPromotionsPage } from './pages/CompetitorPromotionsPage';
import { LoginPage } from './pages/LoginPage';
import { PriceHistoryPage } from './pages/PriceHistoryPage';
import { PricesTab } from './pages/PricesTab';
import { ReputationTab } from './pages/ReputationTab';
import { NetworkOverviewPage } from './pages/NetworkOverviewPage';
import { PortalShell } from './pages/PortalShell';
import { useCan, useStationContext } from './pages/station-context';
import { TeamPage } from './pages/TeamPage';
import { StationsPage } from './pages/StationsPage';

/** Telas que recebem o posto da moldura (StationShell). */
function PricesRoute() {
  const { station } = useStationContext();
  return <PricesTab station={station} canUpdate={useCan('update_price')} />;
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
        <p className="muted">Carregando…</p>
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
  const user = state.user;
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout>
            <StationsPage user={user} />
          </Layout>
        }
      />
      <Route
        path="/acesso"
        element={
          <Layout>
            <ClaimsPage user={user} />
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
