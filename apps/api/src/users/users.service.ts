import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Me } from '@tankei/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  sessions,
  stationClaims,
  stationManagers,
  stations,
  userIdentities,
  users,
} from '../database/schema';
import { stationDisplayName } from '../stations/display-name';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async me(userId: string): Promise<Me> {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!user) throw new NotFoundException('Conta não encontrada.');

    const managed = await this.db
      .select({
        id: stations.id,
        tradeName: stations.tradeName,
        legalName: stations.legalName,
      })
      .from(stationManagers)
      .innerJoin(stations, eq(stations.id, stationManagers.stationId))
      .where(eq(stationManagers.userId, userId))
      .orderBy(stations.legalName);

    return {
      ...user,
      managedStations: managed.map((station) => ({
        id: station.id,
        name: stationDisplayName(station.tradeName, station.legalName),
      })),
    };
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
        .set({
          name: null,
          email: null,
          avatarUrl: null,
          deletedAt: new Date(),
        })
        .where(eq(users.id, userId));
      await tx.delete(userIdentities).where(eq(userIdentities.userId, userId));
      await tx
        .delete(stationManagers)
        .where(eq(stationManagers.userId, userId));
      // Contato dos pedidos de posto (ADR 0019); o pedido e a decisão ficam.
      await tx
        .update(stationClaims)
        .set({ contactName: null, phone: null, message: null })
        .where(eq(stationClaims.userId, userId));
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
      // Vínculo direto pelo administrador: verificação presencial (ADR 0011).
      .values({
        stationId,
        userId,
        createdByUserId,
        role: 'responsavel',
        verificationMethod: 'presencial',
        verifiedAt: new Date(),
      })
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
