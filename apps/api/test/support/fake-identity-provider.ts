import type { AuthProvider } from '@tankei/shared';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OidcIdentityVerifier } from '../../src/auth/identity/identity-verifier';

export const FAKE_ISSUER = 'https://accounts.google.com';
export const FAKE_AUDIENCE = 'tankei-teste.apps.googleusercontent.com';
const KEY_ID = 'chave-de-teste';

/**
 * Provedor de identidade falso, só para testes: assina tokens com uma chave
 * gerada na hora, no mesmo formato dos tokens do Google, e o verificador
 * valida com a chave pública correspondente.
 */
export function createFakeIdentityProvider(provider: AuthProvider = 'google') {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const verifier = new OidcIdentityVerifier({
    provider,
    issuers: [FAKE_ISSUER],
    audiences: [FAKE_AUDIENCE],
    getKey: (kid) =>
      kid === KEY_ID
        ? Promise.resolve(publicKey)
        : Promise.reject(new Error('kid desconhecido')),
  });

  function sign(
    subject: string,
    claims: Record<string, unknown> = {},
    options: jwt.SignOptions = {},
  ): string {
    return jwt.sign(claims, privateKey, {
      algorithm: 'RS256',
      keyid: KEY_ID,
      issuer: FAKE_ISSUER,
      audience: FAKE_AUDIENCE,
      subject,
      expiresIn: 300,
      ...options,
    });
  }

  return { verifier, sign };
}
