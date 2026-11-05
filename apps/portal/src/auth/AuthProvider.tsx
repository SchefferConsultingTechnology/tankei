import { useQueryClient } from '@tanstack/react-query';
import { loginResponseSchema, meSchema, type Me } from '@tankei/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { z } from 'zod';
import { apiRequest } from '../api/client';
import {
  authorizedRequest,
  clearSession,
  hasStoredSession,
  saveSession,
} from '../api/session';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: Me };

interface AuthContext {
  state: AuthState;
  /** Recebe o ID token do botão do Google e abre a sessão na API. */
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Recarrega a conta (por exemplo, depois que um pedido de posto é aprovado). */
  refreshUser: () => Promise<void>;
}

const Context = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    hasStoredSession() ? { status: 'loading' } : { status: 'signedOut' },
  );

  // Retoma a sessão salva (renova o token de acesso e carrega a conta).
  useEffect(() => {
    if (!hasStoredSession()) return;
    authorizedRequest('/me', meSchema)
      .then((user) => setState({ status: 'signedIn', user }))
      // Sessão recusada (já apagada) ou sem conexão (mantida para a próxima
      // visita): nos dois casos, mostra a entrada.
      .catch(() => setState({ status: 'signedOut' }));
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    const response = await apiRequest('/auth/login', loginResponseSchema, {
      method: 'POST',
      body: { provider: 'google', idToken },
    });
    saveSession(response);
    setState({ status: 'signedIn', user: response.user });
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = clearSession();
    setState({ status: 'signedOut' });
    queryClient.clear();
    if (refreshToken) {
      await apiRequest('/auth/logout', z.unknown(), {
        method: 'POST',
        body: { refreshToken },
      }).catch(() => undefined);
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const user = await authorizedRequest('/me', meSchema);
    setState({ status: 'signedIn', user });
  }, []);

  return (
    <Context.Provider value={{ state, signInWithGoogle, signOut, refreshUser }}>
      {children}
    </Context.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContext {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider ausente.');
  return value;
}
