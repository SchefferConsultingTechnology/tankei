import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { LoginRequest, LoginResponse } from '@tankei/shared';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { userIdentities, users } from '../database/schema';
import { UsersService } from '../users/users.service';
import {
  IDENTITY_VERIFIERS,
  type IdentityVerifiers,
} from './identity/identity-verifiers.provider';
import type { VerifiedIdentity } from './identity/identity-verifier';
import { TokensService } from './tokens.service';

const PROVIDER_LABELS = { google: 'Google', apple: 'Apple' } as const;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(IDENTITY_VERIFIERS) private readonly verifiers: IdentityVerifiers,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
  ) {}

  /**
   * Login com Google ou Apple (ADR 0007). Na primeira vez, cria a conta como
   * motorista. Nas seguintes, atualiza o e-mail verificado.
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const verifier = this.verifiers[request.provider];
    if (!verifier) {
      throw new BadRequestException(
        `Login com ${PROVIDER_LABELS[request.provider]} não está disponível.`,
      );
    }
    const identity = await verifier.verify(request.idToken);
    const user = await this.findOrCreateUser(identity, request.name);

    const tokens = await this.tokens.issue(user);
    return { ...tokens, user: await this.users.me(user.id) };
  }

  private async findOrCreateUser(identity: VerifiedIdentity, name?: string) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id, role: users.role })
        .from(userIdentities)
        .innerJoin(users, eq(users.id, userIdentities.userId))
        .where(
          and(
            eq(userIdentities.provider, identity.provider),
            eq(userIdentities.subject, identity.subject),
          ),
        );

      if (existing) {
        if (identity.email) {
          await tx
            .update(users)
            .set({ email: identity.email })
            .where(eq(users.id, existing.id));
        }
        return existing;
      }

      const [created] = await tx
        .insert(users)
        .values({ name: name ?? identity.name, email: identity.email })
        .returning({ id: users.id, role: users.role });
      await tx.insert(userIdentities).values({
        userId: created.id,
        provider: identity.provider,
        subject: identity.subject,
      });
      return created;
    });
  }
}
