import type { z } from 'zod';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * GET na API, com a resposta validada pelo schema do @tankei/shared: se a API
 * e o app saírem de sincronia, o erro aparece aqui, não numa tela quebrada.
 */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
): Promise<z.output<S>> {
  if (!API_URL) {
    throw new ApiError('EXPO_PUBLIC_API_URL não configurada.', 0);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch {
    throw new ApiError(
      'Sem conexão com o servidor. Verifique sua internet.',
      0,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String(body.message)
        : 'Não foi possível carregar os dados.';
    throw new ApiError(message, response.status);
  }
  return schema.parse(body);
}
