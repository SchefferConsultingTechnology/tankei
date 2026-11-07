import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AdminAgreement,
  type Agreement,
  type AgreementDiscount,
  type CreateAgreement,
  type SetStationAgreement,
  type StationAgreement,
  type UpdateAgreement,
} from '@tankei/shared';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import { normalized } from '../database/normalized';
import { agreements, stationAgreementVersions } from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { ParametersService } from '../parameters/parameters.service';

const SEARCH_LIMIT = 20;

/**
 * Convênios (ADR 0034): cadastro único e descontos por posto. O desconto não
 * muda o preço exibido no mapa e na lista nem a ordem por menor preço.
 */
@Injectable()
export class AgreementsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
    private readonly parameters: ParametersService,
  ) {}

  // ---------- Cadastro ----------

  /** Convênios ativos pelo nome (sem acento e sem diferenciar maiúsculas). */
  async search(q: string): Promise<Agreement[]> {
    const rows = await this.db
      .select({
        id: agreements.id,
        name: agreements.name,
        description: agreements.description,
      })
      .from(agreements)
      .where(
        and(
          eq(agreements.active, true),
          q
            ? sql`${normalized(sql`${agreements.name}`)} like ${normalized(`%${q}%`)}`
            : undefined,
        ),
      )
      .orderBy(asc(agreements.name))
      .limit(SEARCH_LIMIT);
    return rows;
  }

  /**
   * Cria pelo portal. Se já existe um com o mesmo nome (sem acento e sem
   * diferenciar maiúsculas), devolve o existente em vez de duplicar.
   */
  async createFromPortal(
    userId: string,
    body: CreateAgreement,
  ): Promise<Agreement> {
    const existing = await this.byName(body.name);
    if (existing) {
      if (!existing.active) {
        throw new ConflictException(
          'Este convênio foi desativado pela equipe Tankei. Fale com a equipe para usá-lo.',
        );
      }
      return {
        id: existing.id,
        name: existing.name,
        description: existing.description,
      };
    }
    const [row] = await this.db
      .insert(agreements)
      .values({
        name: body.name,
        description: body.description || null,
        createdFrom: 'portal',
        createdByUserId: userId,
      })
      .returning();
    return { id: row.id, name: row.name, description: row.description };
  }

  async adminList(): Promise<AdminAgreement[]> {
    const rows = await this.db
      .select()
      .from(agreements)
      .orderBy(asc(agreements.name));
    const ids = rows.map((r) => r.id);
    const [current, used] = await Promise.all([
      this.currentVersions({ agreementIds: ids }),
      ids.length === 0
        ? []
        : this.db
            .select({
              agreementId: stationAgreementVersions.agreementId,
              total: count(),
            })
            .from(stationAgreementVersions)
            .where(inArray(stationAgreementVersions.agreementId, ids))
            .groupBy(stationAgreementVersions.agreementId),
    ]);
    const usingNow = new Map<string, number>();
    for (const v of current) {
      if (v.active) {
        usingNow.set(v.agreementId, (usingNow.get(v.agreementId) ?? 0) + 1);
      }
    }
    const everUsed = new Set(used.map((u) => u.agreementId));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      active: r.active,
      createdFrom: r.createdFrom === 'admin' ? 'admin' : 'portal',
      stationsUsing: usingNow.get(r.id) ?? 0,
      everUsed: everUsed.has(r.id),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async adminCreate(userId: string, body: CreateAgreement) {
    if (await this.byName(body.name)) {
      throw new ConflictException('Já existe um convênio com este nome.');
    }
    const [row] = await this.db
      .insert(agreements)
      .values({
        name: body.name,
        description: body.description || null,
        createdFrom: 'admin',
        createdByUserId: userId,
      })
      .returning({ id: agreements.id });
    return this.adminOne(row.id);
  }

  async adminUpdate(agreementId: string, body: UpdateAgreement) {
    await this.ensureAgreement(agreementId);
    if (body.name) {
      const same = await this.byName(body.name);
      if (same && same.id !== agreementId) {
        throw new ConflictException('Já existe um convênio com este nome.');
      }
    }
    await this.db
      .update(agreements)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.active !== undefined && { active: body.active }),
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, agreementId));
    return this.adminOne(agreementId);
  }

  /** Só sem uso: convênio que algum posto já usou fica no histórico. */
  async adminRemove(agreementId: string): Promise<void> {
    await this.ensureAgreement(agreementId);
    const [used] = await this.db
      .select({ total: count() })
      .from(stationAgreementVersions)
      .where(eq(stationAgreementVersions.agreementId, agreementId));
    if (used.total > 0) {
      throw new ConflictException(
        'Convênio em uso (ou já usado) por posto: não pode ser excluído. Desative-o.',
      );
    }
    await this.db.delete(agreements).where(eq(agreements.id, agreementId));
  }

  // ---------- Descontos do posto ----------

  async forPortal(
    user: AuthenticatedUser,
    stationId: string,
  ): Promise<StationAgreement[]> {
    await this.access.assert(user, stationId, 'view');
    return (await this.current([stationId])).get(stationId) ?? [];
  }

  async setDiscounts(
    user: AuthenticatedUser,
    stationId: string,
    agreementId: string,
    body: SetStationAgreement,
  ): Promise<StationAgreement[]> {
    await this.access.assert(user, stationId, 'manage_promotions');
    const agreement = await this.ensureAgreement(agreementId);
    if (!agreement.active) {
      throw new BadRequestException('Este convênio está desativado.');
    }
    await this.checkLimits(body.discounts);
    await this.db.insert(stationAgreementVersions).values({
      stationId,
      agreementId,
      discounts: body.discounts,
      note: body.note || null,
      active: true,
      userId: user.id,
    });
    return this.forPortal(user, stationId);
  }

  async end(
    user: AuthenticatedUser,
    stationId: string,
    agreementId: string,
  ): Promise<StationAgreement[]> {
    await this.access.assert(user, stationId, 'manage_promotions');
    const current = (await this.current([stationId])).get(stationId) ?? [];
    if (!current.some((a) => a.agreement.id === agreementId)) {
      throw new NotFoundException('Este convênio não está ativo no posto.');
    }
    await this.db.insert(stationAgreementVersions).values({
      stationId,
      agreementId,
      discounts: [],
      note: null,
      active: false,
      userId: user.id,
    });
    return this.forPortal(user, stationId);
  }

  /** Convênios vigentes por posto (para a lista, a ficha e o portal). */
  async current(
    stationIds: string[],
  ): Promise<Map<string, StationAgreement[]>> {
    const result = new Map<string, StationAgreement[]>();
    if (stationIds.length === 0) return result;
    const versions = await this.currentVersions({ stationIds });
    const active = versions.filter((v) => v.active);
    if (active.length === 0) return result;
    const names = await this.db
      .select({
        id: agreements.id,
        name: agreements.name,
        description: agreements.description,
        active: agreements.active,
      })
      .from(agreements)
      .where(
        inArray(
          agreements.id,
          active.map((v) => v.agreementId),
        ),
      );
    const byId = new Map(names.map((n) => [n.id, n]));
    for (const v of active) {
      const agreement = byId.get(v.agreementId);
      // Convênio desativado pela equipe some do app e do portal.
      if (!agreement?.active) continue;
      const list = result.get(v.stationId) ?? [];
      list.push({
        agreement: {
          id: agreement.id,
          name: agreement.name,
          description: agreement.description,
        },
        discounts: v.discounts,
        note: v.note,
        updatedAt: v.createdAt.toISOString(),
      });
      result.set(v.stationId, list);
    }
    for (const list of result.values()) {
      list.sort((a, b) => a.agreement.name.localeCompare(b.agreement.name));
    }
    return result;
  }

  // ---------- Apoio ----------

  /** Versão mais recente de cada (posto, convênio). */
  private currentVersions(filter: {
    stationIds?: string[];
    agreementIds?: string[];
  }) {
    // inArray com lista vazia vira "false" no Drizzle: nenhum resultado.
    return this.db
      .selectDistinctOn(
        [
          stationAgreementVersions.stationId,
          stationAgreementVersions.agreementId,
        ],
        {
          stationId: stationAgreementVersions.stationId,
          agreementId: stationAgreementVersions.agreementId,
          discounts: stationAgreementVersions.discounts,
          note: stationAgreementVersions.note,
          active: stationAgreementVersions.active,
          createdAt: stationAgreementVersions.createdAt,
        },
      )
      .from(stationAgreementVersions)
      .where(
        and(
          filter.stationIds
            ? inArray(stationAgreementVersions.stationId, filter.stationIds)
            : undefined,
          filter.agreementIds
            ? inArray(stationAgreementVersions.agreementId, filter.agreementIds)
            : undefined,
        ),
      )
      .orderBy(
        stationAgreementVersions.stationId,
        stationAgreementVersions.agreementId,
        desc(stationAgreementVersions.createdAt),
      );
  }

  private async checkLimits(discounts: AgreementDiscount[]) {
    const [maxPct, maxPerLiter] = await Promise.all([
      this.parameters.get('agreement.max_discount_pct'),
      this.parameters.get('agreement.max_discount_per_liter'),
    ]);
    for (const d of discounts) {
      if (d.kind === 'percentual' && d.value > maxPct) {
        throw new BadRequestException(
          `Desconto acima do limite de ${maxPct}%. Confira o valor.`,
        );
      }
      if (d.kind === 'reais_litro' && d.value > maxPerLiter) {
        throw new BadRequestException(
          `Desconto acima do limite de R$ ${maxPerLiter.toFixed(2).replace('.', ',')} por litro. Confira o valor.`,
        );
      }
    }
  }

  private async byName(name: string) {
    const [row] = await this.db
      .select()
      .from(agreements)
      .where(
        sql`${normalized(sql`${agreements.name}`)} = ${normalized(name.trim())}`,
      )
      .limit(1);
    return row;
  }

  private async ensureAgreement(agreementId: string) {
    const [row] = await this.db
      .select()
      .from(agreements)
      .where(eq(agreements.id, agreementId));
    if (!row) throw new NotFoundException('Convênio não encontrado.');
    return row;
  }

  private async adminOne(agreementId: string): Promise<AdminAgreement> {
    const all = await this.adminList();
    const found = all.find((a) => a.id === agreementId);
    if (!found) throw new NotFoundException('Convênio não encontrado.');
    return found;
  }
}
