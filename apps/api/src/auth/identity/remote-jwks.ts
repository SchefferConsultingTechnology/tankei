import { createPublicKey, type JsonWebKey } from 'node:crypto';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const UNKNOWN_KID_RELOAD_INTERVAL_MS = 60_000;
const TIMEOUT_MS = 10_000;

type Jwk = JsonWebKey & { kid?: string; kty?: string };

/**
 * Chaves públicas do provedor (JWKS), em PEM, por `kid`. Ficam em cache e são
 * recarregadas quando aparece um `kid` desconhecido (rotação de chaves), no
 * máximo uma vez por minuto, para que tokens forjados não forcem downloads.
 */
export function remoteJwks(jwksUri: string) {
  let cache: { keys: Map<string, string>; loadedAt: number } | undefined;
  let lastUnknownReload = 0;

  async function load(): Promise<Map<string, string>> {
    const response = await fetch(jwksUri, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`JWKS respondeu ${response.status} em ${jwksUri}`);
    }
    const { keys } = (await response.json()) as { keys: Jwk[] };
    const pems = new Map<string, string>();
    for (const jwk of keys) {
      if (!jwk.kid || jwk.kty !== 'RSA') continue;
      const pem = createPublicKey({ key: jwk, format: 'jwk' })
        .export({ type: 'spki', format: 'pem' })
        .toString();
      pems.set(jwk.kid, pem);
    }
    cache = { keys: pems, loadedAt: Date.now() };
    return pems;
  }

  return async (kid: string): Promise<string> => {
    let keys =
      cache && Date.now() - cache.loadedAt < CACHE_TTL_MS
        ? cache.keys
        : await load();

    if (
      !keys.has(kid) &&
      Date.now() - lastUnknownReload > UNKNOWN_KID_RELOAD_INTERVAL_MS
    ) {
      lastUnknownReload = Date.now();
      keys = await load();
    }

    const key = keys.get(kid);
    if (!key) throw new Error(`Chave desconhecida: ${kid}`);
    return key;
  };
}
