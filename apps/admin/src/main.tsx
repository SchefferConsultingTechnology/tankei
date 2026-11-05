import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { MuiProvider } from './components/MuiProvider';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // Preços mudam ao longo do dia: dados de até 1 minuto são reaproveitados.
    queries: { staleTime: 60_000, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MuiProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </MuiProvider>
    </QueryClientProvider>
  </StrictMode>,
);
