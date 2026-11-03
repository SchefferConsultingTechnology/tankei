import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthTokens, UserRole } from '@tankei/shared';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { DRIZZLE, type Database } from '../database/database.module';
import { sessions, users } from '../database/schema';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';

const ISSUER = 'tankei-api';
const AUDIENCE = 'tankei';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

/**
 * Sessão (ADR 0007): token de acesso JWT de curta duração e token de
 * renovação opaco, guardado no banco só como hash, trocado a cada uso.
 */
@Injectable()
export class TokensService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** Abre uma sessão nova (login). */
  issue(user: AuthenticatedUser): Promise<AuthTokens> {
    return this.createSession(user, randomUUID());
  }

  /**
   * Troca o token de renovação por um novo par. Reutilizar um token já trocado
   * indica vazamento: a família inteira de sessões é revogada.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const invalid = () =>
      new UnauthorizedException('Sessão expirada. Entre novamente.');

    // Revoga e lê na mesma instrução: duas renovações simultâneas com o mesmo
    // token não conseguem as duas.
    const [session] = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.refreshTokenHash, hash(refreshToken)),
          isNull(sessions.revokedAt),
        ),
      )
      .returning();

    if (!session) {
      await this.revokeFamilyOf(refreshToken);
      throw invalid();
    }
    if (session.expiresAt <= new Date()) throw invalid();

    const [user] = await this.db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, session.userId), isNull(users.deletedAt)));
    if (!user) throw invalid();

    return this.createSession(user, session.familyId);
  }

  /** Encerra a sessão (logout). Token desconhecido não é erro. */
  async revoke(refreshToken: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.refreshTokenHash, hash(refreshToken)),
          isNull(sessions.revokedAt),
        ),
      );
  }

  /** Encerra todas as sessões abertas do usuário. */
  async revokeAll(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  verifyAccessToken(token: string): AuthenticatedUser {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as JwtPayload & { role: UserRole };
      if (!payload.sub) throw new Error('sem sub');
      return { id: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }

  private async createSession(
    user: AuthenticatedUser,
    familyId: string,
  ): Promise<AuthTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );
    await this.db.insert(sessions).values({
      userId: user.id,
      familyId,
      refreshTokenHash: hash(refreshToken),
      expiresAt,
    });

    const accessToken = jwt.sign({ role: user.role }, this.config.jwtSecret, {
      algorithm: 'HS256',
      subject: user.id,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: this.config.accessTokenTtlSeconds,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTokenTtlSeconds,
    };
  }

  private async revokeFamilyOf(refreshToken: string): Promise<void> {
    const [reused] = await this.db
      .select({ familyId: sessions.familyId })
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshTokenHash, hash(refreshToken)),
          gt(sessions.expiresAt, new Date()),
        ),
      );
    if (!reused) return;
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(sessions.familyId, reused.familyId), isNull(sessions.revokedAt)),
      );
  }
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
