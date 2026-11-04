import type { Municipality } from '@tankei/shared';
import { createContext, useContext, useState, type ReactNode } from 'react';

/** Onde o app procura postos: perto da pessoa ou numa cidade escolhida. */
export type Place =
  { kind: 'nearby' } | { kind: 'city'; municipality: Municipality };

const PlaceContext = createContext<{
  place: Place;
  setPlace: (place: Place) => void;
} | null>(null);

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<Place>({ kind: 'nearby' });
  return (
    <PlaceContext.Provider value={{ place, setPlace }}>
      {children}
    </PlaceContext.Provider>
  );
}

export function usePlace() {
  const context = useContext(PlaceContext);
  if (!context) throw new Error('usePlace fora do PlaceProvider');
  return context;
}
