import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * "Meu carro" (ADR 0029), guardado só no aparelho: tanque e consumo, para a
 * calculadora etanol x gasolina e o "vale a pena ir até lá?". Sem consumo
 * informado, a calculadora usa a regra dos 70%.
 */
export interface CarProfile {
  tankLiters: number;
  /** km/l com gasolina; nulo se a pessoa não informou. */
  kmPerLiterGasoline: number | null;
  /** km/l com etanol; nulo se a pessoa não informou. */
  kmPerLiterEthanol: number | null;
}

const STORAGE_KEY = 'tankei:car';

export const DEFAULT_CAR: CarProfile = {
  tankLiters: 40,
  kmPerLiterGasoline: null,
  kmPerLiterEthanol: null,
};

/** Consumo médio usado no desvio quando a pessoa não informou o do carro. */
export const DEFAULT_KM_PER_LITER = 10;

export function useCarProfile(): [CarProfile, (car: CarProfile) => void] {
  const [car, setCar] = useState<CarProfile>(DEFAULT_CAR);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!saved) return;
        const parsed = JSON.parse(saved) as Partial<CarProfile>;
        setCar({ ...DEFAULT_CAR, ...parsed });
      })
      .catch(() => undefined);
  }, []);

  const save = useCallback((next: CarProfile) => {
    setCar(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(
      () => undefined,
    );
  }, []);

  return [car, save];
}
