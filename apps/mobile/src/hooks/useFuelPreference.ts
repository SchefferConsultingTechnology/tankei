import AsyncStorage from '@react-native-async-storage/async-storage';
import { FUEL_TYPES, type FuelType } from '@tankei/shared';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tankei:fuel';
const DEFAULT_FUEL: FuelType = 'gasolina_comum';

/** Combustível escolhido, lembrado entre as aberturas do app. */
export function useFuelPreference(): [FuelType, (fuel: FuelType) => void] {
  const [fuel, setFuel] = useState<FuelType>(DEFAULT_FUEL);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && (FUEL_TYPES as readonly string[]).includes(saved)) {
          setFuel(saved as FuelType);
        }
      })
      .catch(() => undefined);
  }, []);

  const choose = useCallback((next: FuelType) => {
    setFuel(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  return [fuel, choose];
}
