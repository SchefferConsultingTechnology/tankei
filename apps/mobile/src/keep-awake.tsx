import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'tankei:keepScreenOn';
const TAG = 'tankei-app';

interface KeepScreenOn {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const KeepScreenOnContext = createContext<KeepScreenOn | null>(null);

/**
 * Tela sempre ligada com o app aberto, como no Maps e no Waze (ligado por
 * padrão, pode ser desligado em Conta). O Android só mantém a tela acesa
 * enquanto o app está em primeiro plano: em segundo plano, volta ao normal.
 */
export function KeepScreenOnProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'false') setEnabledState(false);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    activateKeepAwakeAsync(TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(TAG).catch(() => undefined);
    };
  }, [enabled]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return (
    <KeepScreenOnContext.Provider value={value}>
      {children}
    </KeepScreenOnContext.Provider>
  );
}

export function useKeepScreenOn(): KeepScreenOn {
  const value = useContext(KeepScreenOnContext);
  if (!value) throw new Error('KeepScreenOnProvider ausente.');
  return value;
}
