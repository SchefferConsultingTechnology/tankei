import { authTokensSchema, type AuthTokens } from '@tankei/shared';
import type { z } from 'zod';
import { ApiError, apiRequest, type RequestOptions } from './client';

/**
 * Sessão no navegador (ADR 0018). O token de acesso fica só na memória; o de
 * renovação fica no localStorage para a sessão sobreviver ao recarregar. Ele
 * vale uma única vez (a API troca a cada uso e revoga a família se um token
 * já usado reaparecer), o que limita o estrago se vazar.
 */
const REFRESH_TOKEN_KEY = 'tankei:refreshToken';
const EXPIRY_MARGIN_MS = 30_000;

let access: { token: string; expiresAt: number } | null = null;
let renewing: Promise<string | null> | null = null;

function readRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(value: string | null) {
  try {
    if (value) localStorage.setItem(REFRESH_TOKEN_KEY, value);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Armazenamento bloqueado: a sessão dura até fechar a aba.
  }
}

export function saveSession(tokens: AuthTokens) {
  access = {
    token: tokens.accessToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  writeRefresh(tokens.refreshToken);
}

/** Apaga a sessão e devolve o token de renovação, para revogar na API. */
export function clearSession(): string | null {
  access = null;
  const refreshToken = readRefresh();
  writeRefresh(null);
  return refreshToken;
}

export function hasStoredSession(): boolean {
  return readRefresh() !== null;
}

/**
 * Token de acesso válido, renovado quando preciso; `null` sem sessão. Chamadas
 * simultâneas esperam a mesma renovação (o token de renovação só vale uma vez).
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
  const refreshToken = readRefresh();
  if (!refreshToken) return null;
  try {
    const tokens = await apiRequest('/auth/refresh', authTokensSchema, {
      method: 'POST',
      body: { refreshToken },
    });
    saveSession(tokens);
    return tokens.accessToken;
  } catch (error) {
    // Recusado pela API: a sessão acabou. Sem conexão: mantém para tentar depois.
    if (error instanceof ApiError && error.status === 401) {
      clearSession();
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
