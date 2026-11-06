import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FUEL_LABELS, MODERATION_KIND_LABELS } from '@tankei/shared';
import type {
  AdminModerationCase,
  CreateContest,
  DecideModeration,
  ModerationQuery,
  StationModerationCase,
} from '@tankei/shared';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
} from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  priceModerationCaseReports,
  priceModerationCases,
  priceModerationDecisions,
  priceReports,
  stations,
  users,
} from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { MailService } from '../mail/mail.service';
import { moderationDecidedMail, moderationOpenedMail } from '../mail/templates';
import { ParametersService } from '../parameters/parameters.service';
import { pseudonym } from '../prices/pseudonym';
import { cityDisplayName, stationDisplayName } from '../stations/display-name';
import { casesOfReports, openCase } from './moderation-store';

const DAY_MS = 86_400_000;
/** Casos que o posto vê no portal. */
const STATION_HISTORY_DAYS = 90;
const DECIDED_LIMIT = 100;

/**
 * Moderação de informes de preço (ADR 0020 e 0024): o posto contesta, a
 * equipe Tankei decide. Nada é apagado: casos e decisões são só inserção.
 */
@Injectable()
export class ModerationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
    private readonly parameters: ParametersService,
    private readonly mail: MailService,
  ) {}

  // ---------- Posto ----------

  async contest(
    user: AuthenticatedUser,
    stationId: string,
    body: CreateContest,
    now = new Date(),
  ): Promise<StationModerationCase> {
    await this.access.assert(user, stationId, 'contest');
    const ids = [...new Set(body.reportIds)];
    const reports = await this.db
      .select()
      .from(priceReports)
      .where(
        and(
          inArray(priceReports.id, ids),
          eq(priceReports.stationId, stationId),
        ),
      );
    if (reports.length !== ids.length) {
      throw new NotFoundException('Informe não encontrado neste posto.');
    }
    if (reports.some((r) => r.source !== 'usuario')) {
      throw new BadRequestException(
        'Só informes de consumidores podem ser contestados.',
      );
    }
    const fuels = new Set(reports.map((r) => r.fuelType));
    if (fuels.size > 1) {
      throw new BadRequestException(
        'Conteste informes de um combustível por vez.',
      );
    }
    if (reports.some((r) => r.status === 'rejeitado')) {
      throw new BadRequestException(
        'Informe rejeitado não aparece no app e não precisa de contestação.',
      );
    }
    const hideDays = await this.parameters.get('price.hide_after_days');
    if (
      reports.some(
        (r) => now.getTime() - r.reportedAt.getTime() > hideDays * DAY_MS,
      )
    ) {
      throw new BadRequestException(
        'Informe antigo demais: ele já não aparece no app.',
      );
    }
    const existing = await casesOfReports(this.db, ids);
    if (existing.size > 0) {
      throw new ConflictException(
        'Um dos informes já está em análise ou já foi analisado.',
      );
    }

    const caseId = await this.db.transaction((tx) =>
      openCase(tx, {
        kind: 'contestacao',
        stationId,
        fuelType: reports[0].fuelType,
        openedByUserId: user.id,
        reason: body.reason,
        reportIds: ids,
      }),
    );
    const [created] = await this.stationCaseList(stationId, [caseId]);
    this.mail.background(() => this.announceOpened(stationId, created));
    return created;
  }

  async stationCases(
    user: AuthenticatedUser,
    stationId: string,
  ): Promise<StationModerationCase[]> {
    await this.access.assert(user, stationId, 'view');
    return this.stationCaseList(stationId);
  }

  private async stationCaseList(
    stationId: string,
    onlyIds?: string[],
  ): Promise<StationModerationCase[]> {
    const rows = await this.db
      .select({
        id: priceModerationCases.id,
        kind: priceModerationCases.kind,
        fuelType: priceModerationCases.fuelType,
        reason: priceModerationCases.reason,
        createdAt: priceModerationCases.createdAt,
        decision: priceModerationDecisions.decision,
        decisionReason: priceModerationDecisions.reason,
        decidedAt: priceModerationDecisions.decidedAt,
      })
      .from(priceModerationCases)
      .leftJoin(
        priceModerationDecisions,
        eq(priceModerationDecisions.caseId, priceModerationCases.id),
      )
      .where(
        and(
          eq(priceModerationCases.stationId, stationId),
          onlyIds
            ? inArray(priceModerationCases.id, onlyIds)
            : gt(
                priceModerationCases.createdAt,
                new Date(Date.now() - STATION_HISTORY_DAYS * DAY_MS),
              ),
        ),
      )
      .orderBy(desc(priceModerationCases.createdAt));
    const reports = await this.reportsOf(rows.map((r) => r.id));

    return rows.map((row) => {
      const own = reports.filter((r) => r.caseId === row.id);
      return {
        id: row.id,
        kind: row.kind,
        status: row.decision ?? 'em_analise',
        fuelType: row.fuelType,
        prices: [...new Set(own.map((r) => r.price))].sort((a, b) => a - b),
        reports: own.length,
        reason: row.reason,
        decisionReason: row.decisionReason,
        createdAt: row.createdAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
      };
    });
  }

  // ---------- Equipe Tankei ----------

  async adminList(query: ModerationQuery): Promise<AdminModerationCase[]> {
    const open = query.status === 'em_analise';
    const rows = await this.db
      .select({
        id: priceModerationCases.id,
        kind: priceModerationCases.kind,
        stationId: priceModerationCases.stationId,
        fuelType: priceModerationCases.fuelType,
        reason: priceModerationCases.reason,
        createdAt: priceModerationCases.createdAt,
        openedByName: users.name,
        openedByEmail: users.email,
      })
      .from(priceModerationCases)
      .leftJoin(users, eq(users.id, priceModerationCases.openedByUserId))
      .leftJoin(
        priceModerationDecisions,
        eq(priceModerationDecisions.caseId, priceModerationCases.id),
      )
      .where(
        open
          ? isNull(priceModerationDecisions.id)
          : isNotNull(priceModerationDecisions.id),
      )
      .orderBy(
        open
          ? asc(priceModerationCases.createdAt)
          : desc(priceModerationDecisions.decidedAt),
      )
      .limit(open ? 500 : DECIDED_LIMIT);
    return this.toAdmin(rows);
  }

  async decide(
    caseId: string,
    admin: AuthenticatedUser,
    body: DecideModeration,
  ): Promise<AdminModerationCase> {
    const [found] = await this.db
      .select({
        id: priceModerationCases.id,
        kind: priceModerationCases.kind,
        stationId: priceModerationCases.stationId,
        fuelType: priceModerationCases.fuelType,
        reason: priceModerationCases.reason,
        createdAt: priceModerationCases.createdAt,
        openedByName: users.name,
        openedByEmail: users.email,
        decided: priceModerationDecisions.id,
      })
      .from(priceModerationCases)
      .leftJoin(users, eq(users.id, priceModerationCases.openedByUserId))
      .leftJoin(
        priceModerationDecisions,
        eq(priceModerationDecisions.caseId, priceModerationCases.id),
      )
      .where(eq(priceModerationCases.id, caseId));
    if (!found) throw new NotFoundException('Caso não encontrado.');
    if (found.decided) {
      throw new ConflictException('Este caso já foi decidido.');
    }
    await this.db
      .insert(priceModerationDecisions)
      .values({
        caseId,
        decision: body.decision,
        reason: body.reason,
        decidedByUserId: admin.id,
      })
      .onConflictDoNothing();
    const [result] = await this.toAdmin([found]);
    this.mail.background(() => this.announceDecided(result));
    return result;
  }

  /** Aviso à equipe Tankei de uma contestação nova (ADR 0025). */
  private async announceOpened(stationId: string, item: StationModerationCase) {
    const [place] = await this.db
      .select({ tradeName: stations.tradeName, legalName: stations.legalName })
      .from(stations)
      .where(eq(stations.id, stationId));
    this.mail.notify(
      await this.mail.adminEmails(),
      moderationOpenedMail({
        kindLabel: MODERATION_KIND_LABELS[item.kind],
        stationName: place
          ? stationDisplayName(place.tradeName, place.legalName)
          : 'posto',
        fuelLabel: FUEL_LABELS[item.fuelType],
        reports: item.reports,
        reason: item.reason,
      }),
    );
  }

  /** Aviso ao posto da decisão: quem pode contestar (ADR 0025). */
  private async announceDecided(item: AdminModerationCase) {
    if (!item.decision) return;
    const recipients = await this.access.recipients(item.station.id, 'contest');
    this.mail.notify(
      recipients.map((r) => r.email),
      moderationDecidedMail({
        stationId: item.station.id,
        stationName: item.station.name,
        fuelLabel: FUEL_LABELS[item.fuelType],
        annulled: item.decision.decision === 'anulado',
        isContest: item.kind === 'contestacao',
        reason: item.decision.reason,
      }),
    );
  }

  private async toAdmin(
    rows: {
      id: string;
      kind: AdminModerationCase['kind'];
      stationId: string;
      fuelType: AdminModerationCase['fuelType'];
      reason: string | null;
      createdAt: Date;
      openedByName: string | null;
      openedByEmail: string | null;
    }[],
  ): Promise<AdminModerationCase[]> {
    if (rows.length === 0) return [];
    const caseIds = rows.map((r) => r.id);
    const stationIds = [...new Set(rows.map((r) => r.stationId))];
    const [reports, places, decisions, stationPrices] = await Promise.all([
      this.reportsOf(caseIds),
      this.db
        .select({
          id: stations.id,
          tradeName: stations.tradeName,
          legalName: stations.legalName,
          city: stations.city,
          state: stations.state,
        })
        .from(stations)
        .where(inArray(stations.id, stationIds)),
      this.db
        .select({
          caseId: priceModerationDecisions.caseId,
          decision: priceModerationDecisions.decision,
          reason: priceModerationDecisions.reason,
          decidedAt: priceModerationDecisions.decidedAt,
          decidedBy: users.name,
        })
        .from(priceModerationDecisions)
        .leftJoin(users, eq(users.id, priceModerationDecisions.decidedByUserId))
        .where(inArray(priceModerationDecisions.caseId, caseIds)),
      this.db
        .selectDistinctOn([priceReports.stationId, priceReports.fuelType], {
          stationId: priceReports.stationId,
          fuelType: priceReports.fuelType,
          price: priceReports.price,
          reportedAt: priceReports.reportedAt,
        })
        .from(priceReports)
        .where(
          and(
            inArray(priceReports.stationId, stationIds),
            eq(priceReports.source, 'posto'),
            isNull(priceReports.promotionLabel),
          ),
        )
        .orderBy(
          priceReports.stationId,
          priceReports.fuelType,
          desc(priceReports.reportedAt),
        ),
    ]);

    return rows.map((row) => {
      const place = places.find((p) => p.id === row.stationId);
      const decision = decisions.find((d) => d.caseId === row.id);
      const own = stationPrices.find(
        (p) => p.stationId === row.stationId && p.fuelType === row.fuelType,
      );
      return {
        id: row.id,
        kind: row.kind,
        status: decision?.decision ?? 'em_analise',
        station: {
          id: row.stationId,
          name: place
            ? stationDisplayName(place.tradeName, place.legalName)
            : 'Posto',
          city: place ? cityDisplayName(place.city) : '',
          state: place?.state ?? '',
        },
        fuelType: row.fuelType,
        openedBy: row.openedByName ?? row.openedByEmail,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        reports: reports
          .filter((r) => r.caseId === row.id)
          .map((r) => ({
            id: r.id,
            price: r.price,
            reportedAt: r.reportedAt.toISOString(),
            reporter: `Consumidor ${pseudonym(r.reporterUserId, row.stationId)}`,
            status: r.status,
            atStation: r.atStation,
            trusted: r.reporterTrusted,
            reporterAccountDays: r.accountCreatedAt
              ? Math.floor(
                  (r.reportedAt.getTime() - r.accountCreatedAt.getTime()) /
                    DAY_MS,
                )
              : null,
          })),
        stationPrice: own
          ? { price: own.price, reportedAt: own.reportedAt.toISOString() }
          : null,
        decision: decision
          ? {
              decision: decision.decision,
              reason: decision.reason,
              decidedBy: decision.decidedBy,
              decidedAt: decision.decidedAt.toISOString(),
            }
          : null,
      };
    });
  }

  private async reportsOf(caseIds: string[]) {
    if (caseIds.length === 0) return [];
    return this.db
      .select({
        caseId: priceModerationCaseReports.caseId,
        id: priceReports.id,
        price: priceReports.price,
        reportedAt: priceReports.reportedAt,
        status: priceReports.status,
        reporterUserId: priceReports.reporterUserId,
        atStation: priceReports.atStation,
        reporterTrusted: priceReports.reporterTrusted,
        accountCreatedAt: users.createdAt,
      })
      .from(priceModerationCaseReports)
      .innerJoin(
        priceReports,
        eq(priceReports.id, priceModerationCaseReports.reportId),
      )
      .leftJoin(users, eq(users.id, priceReports.reporterUserId))
      .where(inArray(priceModerationCaseReports.caseId, caseIds))
      .orderBy(desc(priceReports.reportedAt));
  }
}
