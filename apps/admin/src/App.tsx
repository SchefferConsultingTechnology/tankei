import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { NavItem } from './components/NavItem';
import { PageLoading } from './components/PageLoading';
import { ClaimsQueuePage } from './pages/ClaimsQueuePage';
import { LoginPage } from './pages/LoginPage';

/** Menu da administração (cresce com moderação e parâmetros). */
const sidebar = (
  <List dense subheader={<ListSubheader>Postos</ListSubheader>}>
    <NavItem
      to="/"
      end
      label="Pedidos de acesso"
      icon={<HowToRegOutlined fontSize="small" />}
    />
  </List>
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
      <Routes>
        <Route path="/" element={<ClaimsQueuePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
