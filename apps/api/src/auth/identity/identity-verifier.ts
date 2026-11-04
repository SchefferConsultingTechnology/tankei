import { UnauthorizedException } from '@nestjs/common';
import type { AuthProvider } from '@tankei/shared';
import jwt, { type JwtPayload } from 'jsonwebtoken';

export interface VerifiedIdentity {
  provider: AuthProvider;
  subject: string;
  /** Só quando o provedor confirma que o e-mail foi verificado. */
  email: string | null;
  name: string | null;
  /** Endereço da foto da conta (claim "picture"; a Apple não envia). */
  picture: string | null;
}

export interface OidcVerifierConfig {
  provider: AuthProvider;
  issuers: [string, ...string[]];
  /** Identificadores de cliente do app (web, Android, iOS) aceitos como público do token. */
  audiences: [string, ...string[]];
  /** Chave pública (PEM) do provedor para o `kid` do token. */
  getKey: (kid: string) => Promise<string>;
}

/** Valida o token de identidade (ID token) emitido pelo Google ou pela Apple. */
export class OidcIdentityVerifier {
  constructor(private readonly config: OidcVerifierConfig) {}

  async verify(idToken: string): Promise<VerifiedIdentity> {
    const invalid = () =>
      new UnauthorizedException('Token de identidade inválido.');

    const decoded = jwt.decode(idToken, { complete: true });
    const kid = decoded?.header.kid;
    if (!kid) throw invalid();

    let payload: JwtPayload;
    try {
      const key = await this.config.getKey(kid);
      payload = jwt.verify(idToken, key, {
        algorithms: ['RS256'],
        issuer: this.config.issuers,
        audience: this.config.audiences,
      }) as JwtPayload;
    } catch {
      throw invalid();
    }
    if (!payload.sub) throw invalid();

    // A Apple envia email_verified como texto ("true").
    const verified = [true, 'true'].includes(
      payload.email_verified as boolean | string,
    );
    return {
      provider: this.config.provider,
      subject: payload.sub,
      email:
        verified && typeof payload.email === 'string' ? payload.email : null,
      name: typeof payload.name === 'string' ? payload.name : null,
      picture:
        typeof payload.picture === 'string' &&
        payload.picture.startsWith('https://')
          ? payload.picture
          : null,
    };
  }
}
