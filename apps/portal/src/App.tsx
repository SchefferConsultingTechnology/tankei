import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { ClaimsPage } from './pages/ClaimsPage';
import { LoginPage } from './pages/LoginPage';
import { StationPage } from './pages/StationPage';
import { StationsPage } from './pages/StationsPage';

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
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<StationsPage user={state.user} />} />
        <Route path="/postos/:id" element={<StationPage />} />
        <Route path="/acesso" element={<ClaimsPage user={state.user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
