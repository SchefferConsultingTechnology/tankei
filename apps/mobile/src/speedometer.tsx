import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Velocímetro (ADR 0032): preferência guardada só no aparelho. Por padrão,
 * aparece acima de 40 km/h; pode ficar sempre visível ou desligado.
 */
export const SPEEDOMETER_MODES = ['acima_40', 'sempre', 'desligado'] as const;
export type SpeedometerMode = (typeof SPEEDOMETER_MODES)[number];

export const SPEEDOMETER_MODE_LABELS: Record<SpeedometerMode, string> = {
  acima_40: 'Acima de 40 km/h',
  sempre: 'Sempre',
  desligado: 'Desligado',
};

/** Faixas de cor do número (km/h): verde, laranja e vermelho acima de cada uma. */
export const SPEED_GREEN_KMH = 40;
export const SPEED_ORANGE_KMH = 80;
export const SPEED_RED_KMH = 110;
/** No modo "acima de 40", some só abaixo disto (não pisca perto do limite). */
export const SPEED_HIDE_BELOW_KMH = 35;

const STORAGE_KEY = 'tankei:speedometer';
const DEFAULT_MODE: SpeedometerMode = 'acima_40';

interface SpeedometerPreference {
  mode: SpeedometerMode;
  setMode: (mode: SpeedometerMode) => void;
}

const SpeedometerContext = createContext<SpeedometerPreference | null>(null);

export function SpeedometerProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SpeedometerMode>(DEFAULT_MODE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && (SPEEDOMETER_MODES as readonly string[]).includes(saved)) {
          setModeState(saved as SpeedometerMode);
        }
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: SpeedometerMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return (
    <SpeedometerContext.Provider value={value}>
      {children}
    </SpeedometerContext.Provider>
  );
}

export function useSpeedometer(): SpeedometerPreference {
  const value = useContext(SpeedometerContext);
  if (!value) throw new Error('SpeedometerProvider ausente.');
  return value;
}
