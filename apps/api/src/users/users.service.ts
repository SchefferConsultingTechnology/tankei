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
  organizationMembers,
  organizationMemberStations,
  organizationStations,
  sessions,
  stationClaims,
  stationManagers,
  stations,
  userIdentities,
  users,
} from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
    private readonly organizations: OrganizationsService,
  ) {}

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

    // Acesso pelo portal vem das redes (ADR 0021).
    const [managed, organizations] = await Promise.all([
      this.access.stationsOf(userId),
      this.organizations.myOrganizations(userId),
    ]);

    return {
      ...user,
      managedStations: managed.map((station) => ({
        id: station.stationId,
        name: station.name,
        organizationId: station.organizationId,
        role: station.role,
      })),
      organizations,
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
      await this.organizations.leaveAll(tx, userId);
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

  /**
   * Vínculo direto pelo administrador (piloto): registra a verificação
   * presencial e dá à pessoa a propriedade do posto na rede dela (ADR 0021).
   */
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

    await this.db.transaction(async (tx) => {
      const inserted = await tx
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
      await this.organizations.grantVerifiedOwnership(
        tx,
        userId,
        stationId,
        createdByUserId,
      );
    });
  }

  /**
   * Retira pelo administrador a verificação da pessoa no posto e o acesso dela
   * à rede do posto (por exemplo, reivindicação indevida). Fica no registro.
   */
  async removeStationManager(
    stationId: string,
    userId: string,
    adminId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(stationManagers)
        .where(
          and(
            eq(stationManagers.stationId, stationId),
            eq(stationManagers.userId, userId),
          ),
        )
        .returning({ userId: stationManagers.userId });
      const [unit] = await tx
        .select({ organizationId: organizationStations.organizationId })
        .from(organizationStations)
        .where(eq(organizationStations.stationId, stationId));
      const left = unit
        ? await tx
            .delete(organizationMembers)
            .where(
              and(
                eq(organizationMembers.organizationId, unit.organizationId),
                eq(organizationMembers.userId, userId),
              ),
            )
            .returning({ userId: organizationMembers.userId })
        : [];
      if (removed.length === 0 && left.length === 0) {
        throw new NotFoundException('Vínculo não encontrado.');
      }
      if (unit && left.length > 0) {
        await tx
          .delete(organizationMemberStations)
          .where(
            and(
              eq(
                organizationMemberStations.organizationId,
                unit.organizationId,
              ),
              eq(organizationMemberStations.userId, userId),
            ),
          );
        await this.organizations.event(
          tx,
          unit.organizationId,
          adminId,
          'membro_removido',
          { userId, stationId, motivo: 'administrador' },
        );
      }
    });
  }
}
