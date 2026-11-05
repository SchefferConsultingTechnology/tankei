import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** Parte da API do Google Identity Services usada aqui. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode?: 'popup' | 'redirect';
      }): void;
      renderButton(
        element: HTMLElement,
        options: Record<string, string | number>,
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let scriptLoading: Promise<GoogleIdentity> | null = null;

function loadGoogle(): Promise<GoogleIdentity> {
  scriptLoading ??= new Promise((resolve, reject) => {
    if (window.google) return resolve(window.google);
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.google ? resolve(window.google) : reject(new Error('sem google'));
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error('Não foi possível carregar o login do Google.'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

interface Props {
  onCredential: (idToken: string) => void;
}

/** Botão oficial "Fazer login com o Google", no tema do portal. */
export function GoogleButton({ onCredential }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const { scheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  // O callback muda a cada renderização; o Google guarda só o primeiro.
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) {
      setError('VITE_GOOGLE_CLIENT_ID não configurado.');
      return;
    }
    let cancelled = false;
    loadGoogle()
      .then((google) => {
        if (cancelled || !container.current) return;
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => callback.current(response.credential),
          ux_mode: 'popup',
        });
        container.current.replaceChildren();
        google.accounts.id.renderButton(container.current, {
          type: 'standard',
          theme: scheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          locale: 'pt-BR',
          width: 280,
        });
      })
      .catch((cause: Error) => setError(cause.message));
    return () => {
      cancelled = true;
    };
  }, [scheme]);

  return (
    <div className="stack" style={{ justifyItems: 'center' }}>
      <div ref={container} style={{ minHeight: 44 }} />
      {error && <p className="error">{error}</p>}
    </div>
  );
}
