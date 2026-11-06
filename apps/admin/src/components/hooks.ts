import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';

/** Celular: janelas em tela cheia. */
export function useMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

/** Valor que só muda depois de a pessoa parar de digitar. */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function errorText(
  error: unknown,
  fallback = 'Não foi possível salvar. Tente de novo.',
): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : fallback;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
