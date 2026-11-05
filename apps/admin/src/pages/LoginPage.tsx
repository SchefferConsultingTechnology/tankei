import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { GoogleButton } from '../auth/GoogleButton';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(idToken: string) {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle(idToken);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível entrar. Tente de novo.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="card stack"
      style={{ maxWidth: 440, margin: '8vh auto 0' }}
    >
      <h1 className="page-title">Administração</h1>
      <p className="muted">
        Área da equipe Tankei: pedidos de acesso dos postos e moderação.
      </p>
      <GoogleButton onCredential={(token) => void handle(token)} />
      {busy && <p className="muted">Entrando…</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted">Só contas de administrador entram aqui.</p>
    </section>
  );
}
