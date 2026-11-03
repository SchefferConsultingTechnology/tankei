import type { Provider } from '@nestjs/common';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

/** Configuração de segurança da sessão, por variável de ambiente. */
export interface AuthConfig {
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
}

export const authConfigProvider: Provider = {
  provide: AUTH_CONFIG,
  useFactory: (): AuthConfig => {
    const jwtSecret = process.env.JWT_SECRET ?? '';
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET ausente ou com menos de 32 caracteres.');
    }
    return {
      jwtSecret,
      accessTokenTtlSeconds: Number(
        process.env.ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60,
      ),
      refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
    };
  },
};
