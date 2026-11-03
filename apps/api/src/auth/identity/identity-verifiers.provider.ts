import type { Provider } from '@nestjs/common';
import type { AuthProvider } from '@tankei/shared';
import { OidcIdentityVerifier } from './identity-verifier';
import { remoteJwks } from './remote-jwks';

export const IDENTITY_VERIFIERS = Symbol('IDENTITY_VERIFIERS');

/** Provedor sem identificadores de cliente configurados fica desativado (null). */
export type IdentityVerifiers = Record<
  AuthProvider,
  OidcIdentityVerifier | null
>;

function clientIds(variable: string): [string, ...string[]] | null {
  const ids = (process.env[variable] ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? (ids as [string, ...string[]]) : null;
}

export const identityVerifiersProvider: Provider = {
  provide: IDENTITY_VERIFIERS,
  useFactory: (): IdentityVerifiers => {
    const google = clientIds('GOOGLE_CLIENT_IDS');
    const apple = clientIds('APPLE_CLIENT_IDS');
    return {
      google: google
        ? new OidcIdentityVerifier({
            provider: 'google',
            issuers: ['https://accounts.google.com', 'accounts.google.com'],
            audiences: google,
            getKey: remoteJwks('https://www.googleapis.com/oauth2/v3/certs'),
          })
        : null,
      apple: apple
        ? new OidcIdentityVerifier({
            provider: 'apple',
            issuers: ['https://appleid.apple.com'],
            audiences: apple,
            getKey: remoteJwks('https://appleid.apple.com/auth/keys'),
          })
        : null,
    };
  },
};
