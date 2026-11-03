import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Me } from '@tankei/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  sessions,
  stationManagers,
  stations,
  userIdentities,
  users,
} from '../database/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async me(userId: string): Promise<Me> {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!user) throw new NotFoundException('Conta não encontrada.');

    const managedStations = await this.db
      .select({
        id: stations.id,
        name: sql<string>`coalesce(${stations.tradeName}, ${stations.legalName})`,
      })
      .from(stationManagers)
      .innerJoin(stations, eq(stations.id, stationManagers.stationId))
      .where(eq(stationManagers.userId, userId))
      .orderBy(stations.legalName);

    return { ...user, managedStations };
  }

  /**
   * Exclusão da conta (ADR 0009): apaga os dados pessoais e os vínculos e
   * encerra as sessões. A linha do usuário fica, anônima, para manter o
   * histórico de informes e avaliações.
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ name: null, email: null, deletedAt: new Date() })
        .where(eq(users.id, userId));
      await tx.delete(userIdentities).where(eq(userIdentities.userId, userId));
      await tx
        .delete(stationManagers)
        .where(eq(stationManagers.userId, userId));
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    });
  }

  /** Vincula um gestor a um posto (feito pelo administrador no piloto). */
  async addStationManager(
    stationId: string,
    userId: string,
    createdByUserId: string,
  ): Promise<void> {
    const [station] = await this.db
      .select({ id: stations.id })
      .from(stations)
      .where(eq(stations.id, stationId));
    if (!station) throw new NotFoundException('Posto não encontrado.');

    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const inserted = await this.db
      .insert(stationManagers)
      .values({ stationId, userId, createdByUserId })
      .onConflictDoNothing()
      .returning({ userId: stationManagers.userId });
    if (inserted.length === 0) {
      throw new ConflictException('Este usuário já gerencia o posto.');
    }
  }

  async removeStationManager(stationId: string, userId: string): Promise<void> {
    const removed = await this.db
      .delete(stationManagers)
      .where(
        and(
          eq(stationManagers.stationId, stationId),
          eq(stationManagers.userId, userId),
        ),
      )
      .returning({ userId: stationManagers.userId });
    if (removed.length === 0) {
      throw new NotFoundException('Vínculo não encontrado.');
    }
  }

  /** Se o usuário gerencia o posto. Usado na autorização das ações de gestor. */
  async managesStation(userId: string, stationId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ userId: stationManagers.userId })
      .from(stationManagers)
      .where(
        and(
          eq(stationManagers.userId, userId),
          eq(stationManagers.stationId, stationId),
        ),
      );
    return Boolean(row);
  }
}
