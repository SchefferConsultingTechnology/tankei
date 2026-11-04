import { authTokensSchema, type AuthTokens } from '@tankei/shared';
import * as SecureStore from 'expo-secure-store';
import type { z } from 'zod';
import { ApiError, apiRequest, type RequestOptions } from '@/api/client';

/** O token de renovação fica no armazenamento seguro do aparelho. */
const REFRESH_TOKEN_KEY = 'tankei.refreshToken';

/** Renova o token de acesso um pouco antes de ele vencer. */
const EXPIRY_MARGIN_MS = 30_000;

// O token de acesso fica só na memória: dura minutos e é renovado ao abrir o app.
let access: { token: string; expiresAt: number } | null = null;
let renewing: Promise<string | null> | null = null;

export async function saveSession(tokens: AuthTokens): Promise<void> {
  access = {
    token: tokens.accessToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

/** Apaga a sessão do aparelho e devolve o token de renovação, para revogar na API. */
export async function clearSession(): Promise<string | null> {
  access = null;
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  return refreshToken;
}

/**
 * Token de acesso válido, renovado quando preciso; `null` quando não há sessão.
 * O token de renovação só vale uma vez: chamadas simultâneas esperam a mesma
 * renovação em vez de gastar o token duas vezes.
 */
export function accessToken(): Promise<string | null> {
  if (access && access.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return Promise.resolve(access.token);
  }
  renewing ??= renew().finally(() => {
    renewing = null;
  });
  return renewing;
}

async function renew(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    const tokens = await apiRequest('/auth/refresh', authTokensSchema, {
      method: 'POST',
      body: { refreshToken },
    });
    await saveSession(tokens);
    return tokens.accessToken;
  } catch (error) {
    // Recusado pela API: a sessão acabou. Sem conexão: mantém para tentar depois.
    if (error instanceof ApiError && error.status === 401) {
      await clearSession();
      return null;
    }
    throw error;
  }
}

/** Chamada a uma rota que exige login. */
export async function authorizedRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  options: Omit<RequestOptions, 'token'> = {},
): Promise<z.output<S>> {
  const token = await accessToken();
  if (!token) throw new ApiError('Entre na sua conta para continuar.', 401);
  return apiRequest(path, schema, { ...options, token });
}
