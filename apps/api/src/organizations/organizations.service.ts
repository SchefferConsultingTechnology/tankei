import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateInvitation,
  Invitation,
  InvitationStatus,
  MyInvitation,
  MyOrganization,
  OrgRole,
  Team,
  UpdateMember,
} from '@tankei/shared';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  organizationEvents,
  organizationInvitations,
  organizationMembers,
  organizationMemberStations,
  organizations,
  organizationStations,
  stations,
  users,
} from '../database/schema';
import { ParametersService } from '../parameters/parameters.service';
import { stationDisplayName } from '../stations/display-name';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Db = Database | Tx;

const DAY_MS = 86_400_000;
/** Convites decididos aparecem por este tempo na tela da equipe. */
const INVITATION_HISTORY_DAYS = 90;

/** Redes, equipe, convites e o registro de auditoria da rede (ADR 0021). */
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly parameters: ParametersService,
  ) {}

  // ---------- Redes da pessoa ----------

  async myOrganizations(userId: string): Promise<MyOrganization[]> {
    const memberships = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        role: organizationMembers.role,
        scope: organizationMembers.scope,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(eq(organizationMembers.userId, userId))
      .orderBy(organizations.name);
    if (memberships.length === 0) return [];

    const orgIds = memberships.map((m) => m.id);
    const units = await this.unitsOf(orgIds);
    const chosen = await this.db
      .select()
      .from(organizationMemberStations)
      .where(
        and(
          eq(organizationMemberStations.userId, userId),
          inArray(organizationMemberStations.organizationId, orgIds),
        ),
      );

    return memberships.map((m) => {
      const all = units.filter((u) => u.organizationId === m.id);
      const picked = new Set(
        chosen.filter((c) => c.organizationId === m.id).map((c) => c.stationId),
      );
      const visible =
        m.scope === 'todas' ? all : all.filter((u) => picked.has(u.id));
      return {
        ...m,
        stations: visible.map(({ id, name }) => ({ id, name })),
        totalStations: all.length,
      };
    });
  }

  /** Papel da pessoa na rede; erro se não for membro. */
  async memberRole(userId: string, organizationId: string): Promise<OrgRole> {
    const [row] = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      );
    if (!row) throw new ForbiddenException('Você não faz parte desta rede.');
    return row.role;
  }

  async assertOwner(user: AuthenticatedUser, organizationId: string) {
    const role = await this.memberRole(user.id, organizationId);
    if (role !== 'proprietario') {
      throw new ForbiddenException(
        'Só proprietários da rede gerenciam a equipe.',
      );
    }
  }

  async rename(user: AuthenticatedUser, organizationId: string, name: string) {
    await this.assertOwner(user, organizationId);
    await this.db.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set({ name })
        .where(eq(organizations.id, organizationId));
      await this.event(tx, organizationId, user.id, 'rede_renomeada', { name });
    });
  }

  /**
   * Dá a quem comprovou ser responsável pelo posto (ADR 0011 e 0019) a
   * propriedade dele: o posto entra na rede da pessoa (criada se preciso).
   * Se o posto já está em outra rede, a pessoa entra nela como proprietária.
   */
  async grantVerifiedOwnership(
    db: Db,
    userId: string,
    stationId: string,
    actorUserId: string,
  ): Promise<string> {
    const [current] = await db
      .select({ organizationId: organizationStations.organizationId })
      .from(organizationStations)
      .where(eq(organizationStations.stationId, stationId));

    if (current) {
      const added = await db
        .insert(organizationMembers)
        .values({
          organizationId: current.organizationId,
          userId,
          role: 'proprietario',
          scope: 'todas',
          createdByUserId: actorUserId,
        })
        .onConflictDoUpdate({
          target: [
            organizationMembers.organizationId,
            organizationMembers.userId,
          ],
          set: { role: 'proprietario', scope: 'todas' },
        })
        .returning({ userId: organizationMembers.userId });
      if (added.length > 0) {
        await this.event(
          db,
          current.organizationId,
          actorUserId,
          'proprietario_verificado',
          {
            userId,
            stationId,
          },
        );
      }
      return current.organizationId;
    }

    // A rede da pessoa: a primeira em que ela é proprietária.
    const [owned] = await db
      .select({ id: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.role, 'proprietario'),
        ),
      )
      .orderBy(organizationMembers.createdAt)
      .limit(1);

    let organizationId = owned?.id;
    if (!organizationId) {
      const [station] = await db
        .select({
          tradeName: stations.tradeName,
          legalName: stations.legalName,
        })
        .from(stations)
        .where(eq(stations.id, stationId));
      const [created] = await db
        .insert(organizations)
        .values({
          name: stationDisplayName(station.tradeName, station.legalName),
          createdByUserId: userId,
        })
        .returning({ id: organizations.id });
      organizationId = created.id;
      await db.insert(organizationMembers).values({
        organizationId,
        userId,
        role: 'proprietario',
        scope: 'todas',
        createdByUserId: actorUserId,
      });
      await this.event(db, organizationId, actorUserId, 'rede_criada', {
        userId,
      });
    }

    await db.insert(organizationStations).values({
      organizationId,
      stationId,
      addedByUserId: actorUserId,
    });
    await this.event(db, organizationId, actorUserId, 'unidade_adicionada', {
      stationId,
      verifiedOwner: userId,
    });
    return organizationId;
  }

  // ---------- Equipe ----------

  async team(user: AuthenticatedUser, organizationId: string): Promise<Team> {
    await this.assertOwner(user, organizationId);
    const [members, chosen, invitations, units] = await Promise.all([
      this.db
        .select({
          userId: organizationMembers.userId,
          name: users.name,
          email: users.email,
          role: organizationMembers.role,
          scope: organizationMembers.scope,
          since: organizationMembers.createdAt,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .where(eq(organizationMembers.organizationId, organizationId))
        .orderBy(organizationMembers.createdAt),
      this.db
        .select()
        .from(organizationMemberStations)
        .where(eq(organizationMemberStations.organizationId, organizationId)),
      this.db
        .select({
          invitation: organizationInvitations,
          invitedBy: users.name,
        })
        .from(organizationInvitations)
        .leftJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
        .where(
          and(
            eq(organizationInvitations.organizationId, organizationId),
            gt(
              organizationInvitations.createdAt,
              new Date(Date.now() - INVITATION_HISTORY_DAYS * DAY_MS),
            ),
          ),
        )
        .orderBy(desc(organizationInvitations.createdAt)),
      this.unitsOf([organizationId]),
    ]);

    const now = new Date();
    const list = invitations.map(({ invitation, invitedBy }) =>
      toInvitation(invitation, invitedBy, now),
    );
    list.sort(
      (a, b) =>
        Number(b.status === 'pendente') - Number(a.status === 'pendente'),
    );

    return {
      members: members.map((m) => ({
        ...m,
        since: m.since.toISOString(),
        stationIds:
          m.scope === 'todas'
            ? []
            : chosen
                .filter((c) => c.userId === m.userId)
                .map((c) => c.stationId),
      })),
      invitations: list,
      stations: units.map(({ id, name }) => ({ id, name })),
    };
  }

  async invite(
    user: AuthenticatedUser,
    organizationId: string,
    body: CreateInvitation,
  ): Promise<Invitation> {
    await this.assertOwner(user, organizationId);
    await this.assertUnitsOf(
      organizationId,
      body.scope === 'todas' ? [] : body.stationIds,
    );

    const [member] = await this.db
      .select({ userId: users.id })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          sql`lower(${users.email}) = ${body.email}`,
        ),
      );
    if (member)
      throw new ConflictException('Essa pessoa já faz parte da equipe.');

    const pending = await this.pendingInvitations(organizationId, body.email);
    if (pending.length > 0) {
      throw new ConflictException(
        'Já existe um convite pendente para esse e-mail. Revogue-o para enviar outro.',
      );
    }

    const validDays = await this.parameters.get('team.invitation_valid_days');
    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(organizationInvitations)
        .values({
          organizationId,
          email: body.email,
          role: body.role,
          scope: body.scope,
          stationIds: body.scope === 'todas' ? [] : body.stationIds,
          invitedByUserId: user.id,
          expiresAt: new Date(Date.now() + validDays * DAY_MS),
        })
        .returning();
      await this.event(tx, organizationId, user.id, 'convite_criado', {
        invitationId: row.id,
        email: body.email,
        role: body.role,
        scope: body.scope,
        stationIds: row.stationIds,
      });
      return row;
    });
    const [inviter] = await this.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.id));
    return toInvitation(created, inviter?.name ?? null, new Date());
  }

  async revokeInvitation(
    user: AuthenticatedUser,
    organizationId: string,
    invitationId: string,
  ): Promise<void> {
    await this.assertOwner(user, organizationId);
    const invitation = await this.openInvitation(invitationId, organizationId);
    await this.db.transaction(async (tx) => {
      await tx
        .update(organizationInvitations)
        .set({ revokedAt: new Date() })
        .where(eq(organizationInvitations.id, invitation.id));
      await this.event(tx, organizationId, user.id, 'convite_revogado', {
        invitationId,
        email: invitation.email,
      });
    });
  }

  async updateMember(
    user: AuthenticatedUser,
    organizationId: string,
    memberId: string,
    body: UpdateMember,
  ): Promise<void> {
    await this.assertOwner(user, organizationId);
    const currentRole = await this.memberRole(memberId, organizationId).catch(
      () => {
        throw new NotFoundException('Pessoa não encontrada na equipe.');
      },
    );
    if (currentRole === 'proprietario' && body.role !== 'proprietario') {
      await this.assertAnotherOwner(organizationId, memberId);
    }
    await this.assertUnitsOf(
      organizationId,
      body.scope === 'todas' ? [] : body.stationIds,
    );

    await this.db.transaction(async (tx) => {
      await tx
        .update(organizationMembers)
        .set({ role: body.role, scope: body.scope })
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, memberId),
          ),
        );
      await this.setMemberStations(tx, organizationId, memberId, body);
      await this.event(tx, organizationId, user.id, 'membro_alterado', {
        userId: memberId,
        role: body.role,
        scope: body.scope,
        stationIds: body.scope === 'todas' ? [] : body.stationIds,
      });
    });
  }

  async removeMember(
    user: AuthenticatedUser,
    organizationId: string,
    memberId: string,
  ): Promise<void> {
    await this.assertOwner(user, organizationId);
    const role = await this.memberRole(memberId, organizationId).catch(() => {
      throw new NotFoundException('Pessoa não encontrada na equipe.');
    });
    if (role === 'proprietario') {
      await this.assertAnotherOwner(organizationId, memberId);
    }
    await this.db.transaction(async (tx) => {
      await this.removeMembership(tx, organizationId, memberId);
      await this.event(tx, organizationId, user.id, 'membro_removido', {
        userId: memberId,
        role,
      });
    });
  }

  /** Na exclusão da conta (ADR 0009): sai de todas as redes, com registro. */
  async leaveAll(tx: Tx, userId: string): Promise<void> {
    const memberships = await tx
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
    for (const { organizationId } of memberships) {
      await this.removeMembership(tx, organizationId, userId);
      await this.event(tx, organizationId, null, 'membro_removido', {
        userId,
        motivo: 'conta_excluida',
      });
    }
  }

  // ---------- Convites recebidos ----------

  async myInvitations(userId: string): Promise<MyInvitation[]> {
    const email = await this.emailOf(userId);
    if (!email) return [];
    const rows = await this.db
      .select({
        invitation: organizationInvitations,
        organizationName: organizations.name,
        invitedBy: users.name,
      })
      .from(organizationInvitations)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationInvitations.organizationId),
      )
      .leftJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
      .where(
        and(
          eq(organizationInvitations.email, email),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.declinedAt),
          isNull(organizationInvitations.revokedAt),
          gt(organizationInvitations.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(organizationInvitations.createdAt));

    const units = await this.unitsOf([
      ...new Set(rows.map((r) => r.invitation.organizationId)),
    ]);
    return rows.map(({ invitation, organizationName, invitedBy }) => {
      const all = units.filter(
        (u) => u.organizationId === invitation.organizationId,
      );
      const picked = new Set(invitation.stationIds);
      return {
        id: invitation.id,
        organization: { id: invitation.organizationId, name: organizationName },
        role: invitation.role,
        stations: (invitation.scope === 'todas'
          ? all
          : all.filter((u) => picked.has(u.id))
        ).map(({ id, name }) => ({ id, name })),
        invitedBy,
        expiresAt: invitation.expiresAt.toISOString(),
      };
    });
  }

  async accept(userId: string, invitationId: string): Promise<void> {
    const invitation = await this.invitationForUser(userId, invitationId);
    await this.db.transaction(async (tx) => {
      await tx
        .update(organizationInvitations)
        .set({ acceptedAt: new Date(), acceptedByUserId: userId })
        .where(eq(organizationInvitations.id, invitationId));
      await tx
        .insert(organizationMembers)
        .values({
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
          scope: invitation.scope,
          createdByUserId: invitation.invitedByUserId,
        })
        .onConflictDoNothing();
      // Estações que saíram da rede depois do convite ficam de fora.
      const units = await this.unitsOf([invitation.organizationId], tx);
      const valid = new Set(units.map((u) => u.id));
      await this.setMemberStations(tx, invitation.organizationId, userId, {
        scope: invitation.scope,
        stationIds: invitation.stationIds.filter((id) => valid.has(id)),
      });
      await this.event(
        tx,
        invitation.organizationId,
        userId,
        'convite_aceito',
        {
          invitationId,
          role: invitation.role,
        },
      );
    });
  }

  async decline(userId: string, invitationId: string): Promise<void> {
    const invitation = await this.invitationForUser(userId, invitationId);
    await this.db.transaction(async (tx) => {
      await tx
        .update(organizationInvitations)
        .set({ declinedAt: new Date() })
        .where(eq(organizationInvitations.id, invitationId));
      await this.event(
        tx,
        invitation.organizationId,
        userId,
        'convite_recusado',
        {
          invitationId,
        },
      );
    });
  }

  // ---------- Apoio ----------

  async event(
    db: Db,
    organizationId: string,
    actorUserId: string | null,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await db
      .insert(organizationEvents)
      .values({ organizationId, actorUserId, action, details });
  }

  /** Unidades das redes informadas, com o nome de exibição. */
  async unitsOf(organizationIds: string[], db: Db = this.db) {
    if (organizationIds.length === 0) return [];
    const rows = await db
      .select({
        organizationId: organizationStations.organizationId,
        id: stations.id,
        tradeName: stations.tradeName,
        legalName: stations.legalName,
      })
      .from(organizationStations)
      .innerJoin(stations, eq(stations.id, organizationStations.stationId))
      .where(inArray(organizationStations.organizationId, organizationIds))
      .orderBy(stations.legalName);
    return rows.map((r) => ({
      organizationId: r.organizationId,
      id: r.id,
      name: stationDisplayName(r.tradeName, r.legalName),
    }));
  }

  private async assertUnitsOf(organizationId: string, stationIds: string[]) {
    if (stationIds.length === 0) return;
    const units = await this.unitsOf([organizationId]);
    const own = new Set(units.map((u) => u.id));
    if (stationIds.some((id) => !own.has(id))) {
      throw new BadRequestException('Escolha só unidades desta rede.');
    }
  }

  private async assertAnotherOwner(
    organizationId: string,
    leavingUserId: string,
  ) {
    const owners = await this.db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.role, 'proprietario'),
        ),
      );
    if (owners.filter((o) => o.userId !== leavingUserId).length === 0) {
      throw new BadRequestException(
        'A rede precisa de ao menos um proprietário. Promova outra pessoa antes.',
      );
    }
  }

  private async setMemberStations(
    tx: Tx,
    organizationId: string,
    userId: string,
    scope: { scope: 'todas' | 'selecionadas'; stationIds: string[] },
  ) {
    await tx
      .delete(organizationMemberStations)
      .where(
        and(
          eq(organizationMemberStations.organizationId, organizationId),
          eq(organizationMemberStations.userId, userId),
        ),
      );
    if (scope.scope === 'selecionadas' && scope.stationIds.length > 0) {
      await tx.insert(organizationMemberStations).values(
        scope.stationIds.map((stationId) => ({
          organizationId,
          userId,
          stationId,
        })),
      );
    }
  }

  private async removeMembership(
    tx: Tx,
    organizationId: string,
    userId: string,
  ) {
    await tx
      .delete(organizationMemberStations)
      .where(
        and(
          eq(organizationMemberStations.organizationId, organizationId),
          eq(organizationMemberStations.userId, userId),
        ),
      );
    await tx
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      );
  }

  private async pendingInvitations(organizationId: string, email: string) {
    return this.db
      .select({ id: organizationInvitations.id })
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(organizationInvitations.email, email),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.declinedAt),
          isNull(organizationInvitations.revokedAt),
          gt(organizationInvitations.expiresAt, new Date()),
        ),
      );
  }

  private async openInvitation(invitationId: string, organizationId?: string) {
    const [invitation] = await this.db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.id, invitationId));
    if (
      !invitation ||
      (organizationId && invitation.organizationId !== organizationId)
    ) {
      throw new NotFoundException('Convite não encontrado.');
    }
    if (invitationStatus(invitation, new Date()) !== 'pendente') {
      throw new BadRequestException('Este convite não está mais pendente.');
    }
    return invitation;
  }

  private async invitationForUser(userId: string, invitationId: string) {
    const invitation = await this.openInvitation(invitationId);
    const email = await this.emailOf(userId);
    if (!email || email !== invitation.email) {
      // Não revela que o convite existe para outro e-mail.
      throw new NotFoundException('Convite não encontrado.');
    }
    return invitation;
  }

  private async emailOf(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    return row?.email?.trim().toLowerCase() ?? null;
  }
}

type InvitationRow = typeof organizationInvitations.$inferSelect;

function invitationStatus(row: InvitationRow, now: Date): InvitationStatus {
  if (row.acceptedAt) return 'aceito';
  if (row.declinedAt) return 'recusado';
  if (row.revokedAt) return 'revogado';
  if (row.expiresAt <= now) return 'expirado';
  return 'pendente';
}

function toInvitation(
  row: InvitationRow,
  invitedBy: string | null,
  now: Date,
): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    scope: row.scope,
    stationIds: row.stationIds,
    status: invitationStatus(row, now),
    invitedBy,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}
