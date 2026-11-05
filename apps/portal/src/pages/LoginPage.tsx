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
      <h1 className="page-title">Portal do posto</h1>
      <p className="muted">
        Atualize os preços do seu posto, acompanhe a concorrência da região e
        veja como os motoristas avaliam o atendimento.
      </p>
      <GoogleButton onCredential={(token) => void handle(token)} />
      {busy && <p className="muted">Entrando…</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted">
        O acesso é liberado para quem responde pelo posto. Ainda não tem? Fale
        com a equipe Tankei.
      </p>
    </section>
  );
}
