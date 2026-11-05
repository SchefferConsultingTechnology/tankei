import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PriceBadge } from '@tankei/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  Appearance,
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { badgePalettes, palettes, type Palette, type Scheme } from '@/theme';

/** Tema escolhido na Conta: seguir o celular, ou fixo claro/escuro. */
export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'tankei:theme';

interface PreferenceContext {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const Context = createContext<PreferenceContext | null>(null);

/**
 * Aplica e lembra o tema escolhido. A escolha passa ao sistema
 * (Appearance.setColorScheme), então useColorScheme, o mapa e os componentes
 * nativos seguem o mesmo tema. `onReady` avisa quando a escolha salva foi
 * aplicada, para a abertura não piscar no tema errado.
 */
export function ThemePreferenceProvider({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady?: () => void;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setPreferenceState(saved);
          Appearance.setColorScheme(saved);
        }
      })
      .catch(() => undefined)
      .finally(() => onReady?.());
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    Appearance.setColorScheme(next === 'auto' ? 'unspecified' : next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  return (
    <Context.Provider value={{ preference, setPreference }}>
      {children}
    </Context.Provider>
  );
}

export function useThemePreference(): PreferenceContext {
  const value = useContext(Context);
  if (!value) throw new Error('ThemePreferenceProvider ausente.');
  return value;
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export interface Theme {
  scheme: Scheme;
  colors: Palette;
  badgeColors: Record<PriceBadge, string>;
}

/** Tema em uso (já com a escolha da Conta aplicada). */
export function useTheme(): Theme {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    scheme,
    colors: palettes[scheme],
    badgeColors: badgePalettes[scheme],
  };
}

/**
 * Estilos que dependem do tema: criados uma vez por tema e reaproveitados.
 * Uso: `const useStyles = createStyles((colors) => ({ ... }))` fora do
 * componente e `const styles = useStyles()` dentro dele.
 */
export function createStyles<S extends NamedStyles>(
  factory: (colors: Palette, badgeColors: Record<PriceBadge, string>) => S &
    NamedStyles,
): () => Readonly<S> {
  const cache: Partial<Record<Scheme, Readonly<S>>> = {};
  return function useStyles() {
    const { scheme, colors, badgeColors } = useTheme();
    return (cache[scheme] ??= StyleSheet.create(factory(colors, badgeColors)));
  };
}
