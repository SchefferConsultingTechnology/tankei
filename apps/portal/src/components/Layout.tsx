import type { ReactNode } from 'react';
import { Link } from 'react-router';
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
const THEME_ICON: Record<ThemePreference, string> = {
  auto: '◐',
  light: '☀',
  dark: '☾',
};

/** Cabeçalho com o logo (variante do tema), tema e conta. */
export function Layout({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth();
  const { preference, scheme, setPreference } = useTheme();

  return (
    <>
      <header className="app-header">
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
        <span className="muted">Portal do posto</span>
        <span className="spacer" />
        <button
          type="button"
          className="button ghost"
          onClick={() => setPreference(THEME_NEXT[preference])}
          title={THEME_LABEL[preference]}
          aria-label={`${THEME_LABEL[preference]}. Trocar`}
        >
          {THEME_ICON[preference]}
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
      <main className="page">{children}</main>
    </>
  );
}
