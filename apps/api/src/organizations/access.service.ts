import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { roleCan, type OrgAction, type OrgRole } from '@tankei/shared';
import { and, eq, exists, or, sql } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  organizationMembers,
  organizationMemberStations,
  organizationStations,
  stations,
} from '../database/schema';
import { stationDisplayName } from '../stations/display-name';

export interface StationAccess {
  stationId: string;
  organizationId: string;
  role: OrgRole;
}

const ACTION_MESSAGES: Record<OrgAction, string> = {
  view: 'Você não faz parte da equipe deste posto.',
  update_price: 'Seu papel no posto não permite atualizar preços.',
  manage_promotions: 'Seu papel no posto não permite gerenciar promoções.',
  contest: 'Seu papel no posto não permite contestar informes.',
  manage_team: 'Só proprietários da rede gerenciam a equipe.',
};

/**
 * Quem pode o quê em cada posto (ADR 0021): resolvido pela rede do posto,
 * pelo papel da pessoa nela e pelo escopo (todas as unidades ou escolhidas).
 * Único lugar da API que responde a essa pergunta.
 */
@Injectable()
export class AccessService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Postos acessíveis à pessoa, com a rede e o papel. */
  async stationsOf(
    userId: string,
    stationId?: string,
  ): Promise<(StationAccess & { name: string })[]> {
    const inScope = or(
      eq(organizationMembers.scope, 'todas'),
      exists(
        this.db
          .select({ one: sql`1` })
          .from(organizationMemberStations)
          .where(
            and(
              eq(
                organizationMemberStations.organizationId,
                organizationMembers.organizationId,
              ),
              eq(organizationMemberStations.userId, organizationMembers.userId),
              eq(
                organizationMemberStations.stationId,
                organizationStations.stationId,
              ),
            ),
          ),
      ),
    );

    const rows = await this.db
      .select({
        stationId: organizationStations.stationId,
        organizationId: organizationStations.organizationId,
        role: organizationMembers.role,
        tradeName: stations.tradeName,
        legalName: stations.legalName,
      })
      .from(organizationMembers)
      .innerJoin(
        organizationStations,
        eq(
          organizationStations.organizationId,
          organizationMembers.organizationId,
        ),
      )
      .innerJoin(stations, eq(stations.id, organizationStations.stationId))
      .where(
        and(
          eq(organizationMembers.userId, userId),
          stationId ? eq(organizationStations.stationId, stationId) : undefined,
          inScope,
        ),
      )
      .orderBy(stations.legalName);

    return rows.map((row) => ({
      stationId: row.stationId,
      organizationId: row.organizationId,
      role: row.role,
      name: stationDisplayName(row.tradeName, row.legalName),
    }));
  }

  /** Papel da pessoa no posto, ou nulo se ela não é da equipe. */
  async roleAt(
    userId: string,
    stationId: string,
  ): Promise<StationAccess | null> {
    const [access] = await this.stationsOf(userId, stationId);
    return access ?? null;
  }

  /**
   * Se a pessoa pode fazer a ação no posto. Administradores da Tankei veem
   * tudo, mas não agem pelo posto (preço do administrador não é "do posto").
   */
  async can(
    user: AuthenticatedUser,
    stationId: string,
    action: OrgAction,
  ): Promise<boolean> {
    if (user.role === 'admin' && action === 'view') return true;
    const access = await this.roleAt(user.id, stationId);
    return access !== null && roleCan(access.role, action);
  }

  async assert(
    user: AuthenticatedUser,
    stationId: string,
    action: OrgAction,
  ): Promise<void> {
    if (!(await this.can(user, stationId, action))) {
      throw new ForbiddenException(ACTION_MESSAGES[action]);
    }
  }
}
