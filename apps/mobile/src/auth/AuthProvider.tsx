import { loginResponseSchema, meSchema, type Me } from '@tankei/shared';
import { z } from 'zod';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest } from '@/api/client';
import { googleIdToken, googleSignOut } from './google';
import {
  accessToken,
  authorizedRequest,
  clearSession,
  saveSession,
} from './session';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: Me };

const AuthContext = createContext<{
  state: AuthState;
  /** Entra com Google. Retorna false se a pessoa desistir. */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // Ao abrir o app, retoma a sessão guardada no aparelho.
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const token = await accessToken();
        const user = token ? await authorizedRequest('/me', meSchema) : null;
        if (active) {
          setState(user ? { status: 'signedIn', user } : { status: 'signedOut' });
        }
      } catch {
        // Sem conexão: a sessão continua guardada e volta na próxima abertura.
        if (active) setState({ status: 'signedOut' });
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const idToken = await googleIdToken();
    if (!idToken) return false;
    const session = await apiRequest('/auth/login', loginResponseSchema, {
      method: 'POST',
      body: { provider: 'google', idToken },
    });
    await saveSession(session);
    setState({ status: 'signedIn', user: session.user });
    return true;
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = await clearSession();
    setState({ status: 'signedOut' });
    // Revogar na API e sair do Google são cortesias: falhas não prendem a pessoa.
    await Promise.allSettled([
      refreshToken
        ? apiRequest('/auth/logout', z.unknown(), {
            method: 'POST',
            body: { refreshToken },
          })
        : Promise.resolve(),
      googleSignOut(),
    ]);
  }, []);

  return (
    <AuthContext.Provider value={{ state, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth fora do AuthProvider');
  return context;
}
