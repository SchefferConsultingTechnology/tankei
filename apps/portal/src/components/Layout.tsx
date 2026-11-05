import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useTheme, type ThemePreference } from '../theme';

const THEME_NEXT: Record<ThemePreference, ThemePreference> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};
const THEME_LABEL: Record<ThemePreference, string> = {
  auto: 'Tema: automático',
  light: 'Tema: claro',
  dark: 'Tema: escuro',
};
/** Ícones em SVG: os caracteres ◐ ☀ ☾ dependiam da fonte do sistema. */
function ThemeIcon({ preference }: { preference: ThemePreference }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (preference === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (preference === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  );
}

/**
 * Cabeçalho com o logo (variante do tema), tema e conta. Com `sidebar`, mostra
 * o menu lateral: fixo no computador, gaveta (botão ☰) no celular.
 */
export function Layout({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
}) {
  const { state, signOut } = useAuth();
  const { preference, scheme, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Escolher um item fecha a gaveta.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <>
      <header className="app-header">
        {sidebar && (
          <button
            type="button"
            className="button ghost menu-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="sidebar"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        )}
        <Link to="/" aria-label="Tankei: início do portal">
          <img
            className="logo"
            src={
              scheme === 'dark'
                ? '/logo-horizontal-dark.png'
                : '/logo-horizontal.png'
            }
            alt="Tankei"
          />
        </Link>
        <span className="muted header-label">Portal do posto</span>
        <span className="spacer" />
        <button
          type="button"
          className="button ghost"
          onClick={() => setPreference(THEME_NEXT[preference])}
          title={THEME_LABEL[preference]}
          aria-label={`${THEME_LABEL[preference]}. Trocar`}
        >
          <ThemeIcon preference={preference} />
        </button>
        {state.status === 'signedIn' && (
          <button
            type="button"
            className="button ghost"
            onClick={() => void signOut()}
          >
            Sair
          </button>
        )}
      </header>
      {sidebar ? (
        <div className="shell">
          <nav
            id="sidebar"
            className={`sidebar${open ? ' open' : ''}`}
            aria-label="Menu do posto"
          >
            {sidebar}
          </nav>
          {open && (
            <div
              className="sidebar-backdrop"
              onClick={() => setOpen(false)}
              aria-hidden
            />
          )}
          <main className="page">{children}</main>
        </div>
      ) : (
        <main className="page">{children}</main>
      )}
    </>
  );
}
