import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { ClaimsQueuePage } from './pages/ClaimsQueuePage';
import { LoginPage } from './pages/LoginPage';

/** Só administradores (ADR 0007); a API também recusa os demais. */
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
  if (state.user.role !== 'admin') {
    return (
      <Layout>
        <section className="card stack">
          <h1 className="page-title">Acesso restrito</h1>
          <p className="muted" style={{ margin: 0 }}>
            Esta área é da equipe Tankei. A conta
            {state.user.email ? ` ${state.user.email}` : ''} não é de
            administrador.
          </p>
        </section>
      </Layout>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ClaimsQueuePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
