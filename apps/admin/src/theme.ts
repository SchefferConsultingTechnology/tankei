import { useCallback, useSyncExternalStore } from 'react';

/** Tema do portal: seguir o sistema (padrão), ou fixo claro/escuro (ADR 0017). */
export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'tankei:theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', listener);
  };
}

function snapshot(): string {
  return `${readPreference()}|${media.matches ? 'dark' : 'light'}`;
}

export function useTheme() {
  const [preference, system] = useSyncExternalStore(subscribe, snapshot).split(
    '|',
  ) as [ThemePreference, 'light' | 'dark'];
  const scheme = preference === 'auto' ? system : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'auto') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem armazenamento: vale só nesta visita.
    }
    // O CSS lê o data-theme da raiz (o index.html aplica o salvo na abertura).
    if (next === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    listeners.forEach((listener) => listener());
  }, []);

  return { preference, scheme, setPreference };
}
