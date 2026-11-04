import type { z } from 'zod';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Código do caso de erro, quando a API informa (ex.: CONFIRMATION_REQUIRED). */
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Token de acesso, para rotas que exigem login. */
  token?: string;
}

/**
 * Chamada à API, com a resposta validada pelo schema do @tankei/shared: se a
 * API e o app saírem de sincronia, o erro aparece aqui, não numa tela quebrada.
 * Resposta sem corpo (204) volta como `undefined`, sem validação.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<z.output<S>> {
  if (!API_URL) {
    throw new ApiError('EXPO_PUBLIC_API_URL não configurada.', 0);
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'Sem conexão com o servidor. Verifique sua internet.',
      0,
    );
  }

  if (response.status === 204) return undefined as z.output<S>;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload : {};
    const message =
      'message' in error
        ? String(error.message)
        : 'Não foi possível carregar os dados.';
    const code = 'code' in error ? String(error.code) : undefined;
    throw new ApiError(message, response.status, code);
  }
  return schema.parse(payload);
}

export function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
): Promise<z.output<S>> {
  return apiRequest(path, schema);
}
