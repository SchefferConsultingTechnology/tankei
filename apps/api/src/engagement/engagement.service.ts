import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  FUEL_LABELS,
  type Contribution,
  type CreatePriceAlert,
  type FuelType,
  type PriceAlert,
  type Station,
} from '@tankei/shared';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  or,
} from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  favoriteStations,
  priceAlerts,
  priceModerationCaseReports,
  priceModerationDecisions,
  priceReports,
  stations,
  users,
} from '../database/schema';
import { MailService } from '../mail/mail.service';
import { priceAlertMail } from '../mail/templates';
import { ParametersService } from '../parameters/parameters.service';
import { PriceReportsService } from '../prices/price-reports.service';
import { stationDisplayName } from '../stations/display-name';
import { StationsService } from '../stations/stations.service';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * Favoritos, alertas de preço por e-mail e contribuição (ADR 0029). O alerta
 * é conferido quando o preço de um posto pode ter mudado (novo informe ou
 * promoção) e respeita um intervalo mínimo entre avisos.
 */
@Injectable()
export class EngagementService implements OnModuleInit {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly parameters: ParametersService,
    private readonly prices: PriceReportsService,
    private readonly stationsService: StationsService,
    private readonly mail: MailService,
  ) {}

  onModuleInit(): void {
    this.prices.onPriceChange((stationId, fuelType) =>
      this.mail.background(async () => {
        await this.checkAlerts(stationId, fuelType);
      }),
    );
  }

  // ---------- Favoritos ----------

  async favorites(userId: string): Promise<Station[]> {
    const rows = await this.db
      .select({ stationId: favoriteStations.stationId })
      .from(favoriteStations)
      .where(eq(favoriteStations.userId, userId))
      .orderBy(desc(favoriteStations.createdAt));
    return this.stationsService.findByIds(rows.map((r) => r.stationId));
  }

  async addFavorite(userId: string, stationId: string): Promise<void> {
    await this.assertStation(stationId);
    const max = await this.parameters.get('favorite.max_per_user');
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(favoriteStations)
      .where(eq(favoriteStations.userId, userId));
    if (total >= max) {
      throw new ConflictException(
        `Você já tem ${max} postos favoritos. Remova um para adicionar outro.`,
      );
    }
    await this.db
      .insert(favoriteStations)
      .values({ userId, stationId })
      .onConflictDoNothing();
  }

  async removeFavorite(userId: string, stationId: string): Promise<void> {
    await this.db
      .delete(favoriteStations)
      .where(
        and(
          eq(favoriteStations.userId, userId),
          eq(favoriteStations.stationId, stationId),
        ),
      );
  }

  // ---------- Alertas de preço ----------

  async alerts(userId: string): Promise<PriceAlert[]> {
    const rows = await this.db
      .select({
        alert: priceAlerts,
        tradeName: stations.tradeName,
        displayName: stations.displayName,
        legalName: stations.legalName,
      })
      .from(priceAlerts)
      .innerJoin(stations, eq(stations.id, priceAlerts.stationId))
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt));
    const current = await this.prices.currentPrices([
      ...new Set(rows.map((r) => r.alert.stationId)),
    ]);
    return rows.map(({ alert, tradeName, legalName, displayName }) => ({
      id: alert.id,
      station: {
        id: alert.stationId,
        name: stationDisplayName(tradeName, legalName, displayName),
      },
      fuelType: alert.fuelType,
      maxPrice: alert.maxPrice,
      currentPrice:
        current.get(alert.stationId)?.find((p) => p.fuelType === alert.fuelType)
          ?.price ?? null,
      lastNotifiedAt: alert.lastNotifiedAt?.toISOString() ?? null,
      createdAt: alert.createdAt.toISOString(),
    }));
  }

  async createAlert(
    userId: string,
    body: CreatePriceAlert,
  ): Promise<PriceAlert> {
    await this.assertStation(body.stationId);
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.email) {
      throw new BadRequestException(
        'Sua conta não tem e-mail para receber o aviso.',
      );
    }
    const max = await this.parameters.get('alert.max_per_user');
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId));
    if (total >= max) {
      throw new ConflictException(
        `Você já tem ${max} alertas. Apague um para criar outro.`,
      );
    }
    const [existing] = await this.db
      .select({ id: priceAlerts.id })
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.userId, userId),
          eq(priceAlerts.stationId, body.stationId),
          eq(priceAlerts.fuelType, body.fuelType),
        ),
      );
    if (existing) {
      throw new ConflictException(
        'Você já tem um alerta para este combustível neste posto. Apague-o para criar outro.',
      );
    }
    const [created] = await this.db
      .insert(priceAlerts)
      .values({ userId, ...body })
      .returning({ id: priceAlerts.id });
    const list = await this.alerts(userId);
    return list.find((a) => a.id === created.id)!;
  }

  async removeAlert(userId: string, alertId: string): Promise<void> {
    const removed = await this.db
      .delete(priceAlerts)
      .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
      .returning({ id: priceAlerts.id });
    if (removed.length === 0) {
      throw new NotFoundException('Alerta não encontrado.');
    }
  }

  /** Avisa os alertas atingidos pelo preço exibido agora. */
  async checkAlerts(
    stationId: string,
    fuelType: FuelType,
    now = new Date(),
  ): Promise<number> {
    const current = (await this.prices.currentPrices([stationId], now))
      .get(stationId)
      ?.find((p) => p.fuelType === fuelType);
    if (!current) return 0;

    const intervalHours = await this.parameters.get('alert.min_interval_hours');
    const due = await this.db
      .select({
        id: priceAlerts.id,
        maxPrice: priceAlerts.maxPrice,
        email: users.email,
      })
      .from(priceAlerts)
      .innerJoin(users, eq(users.id, priceAlerts.userId))
      .where(
        and(
          eq(priceAlerts.stationId, stationId),
          eq(priceAlerts.fuelType, fuelType),
          gte(priceAlerts.maxPrice, current.price),
          isNull(users.deletedAt),
          isNotNull(users.email),
          or(
            isNull(priceAlerts.lastNotifiedAt),
            lt(
              priceAlerts.lastNotifiedAt,
              new Date(now.getTime() - intervalHours * HOUR_MS),
            ),
          ),
        ),
      );
    if (due.length === 0) return 0;

    const [station] = await this.db
      .select({
        tradeName: stations.tradeName,
        displayName: stations.displayName,
        legalName: stations.legalName,
        address: stations.address,
      })
      .from(stations)
      .where(eq(stations.id, stationId));
    for (const alert of due) {
      await this.db
        .update(priceAlerts)
        .set({ lastNotifiedAt: now, lastNotifiedPrice: current.price })
        .where(eq(priceAlerts.id, alert.id));
      this.mail.notify(
        [alert.email!],
        priceAlertMail({
          stationName: stationDisplayName(
            station.tradeName,
            station.legalName,
            station.displayName,
          ),
          fuelLabel: FUEL_LABELS[fuelType],
          price: current.price,
          maxPrice: alert.maxPrice,
          address: station.address,
        }),
      );
    }
    this.logger.log(`${due.length} alerta(s) de preço avisado(s).`);
    return due.length;
  }

  // ---------- Contribuição ----------

  async contribution(userId: string, now = new Date()): Promise<Contribution> {
    const trust = await this.prices.accountTrust(userId, now);
    const reliableMin = await this.parameters.get(
      'contributor.reliable_min_reports',
    );
    const [recent] = await this.db
      .select({
        total: count(),
        stationsHelped: countDistinct(priceReports.stationId),
      })
      .from(priceReports)
      .where(
        and(
          eq(priceReports.reporterUserId, userId),
          eq(priceReports.source, 'usuario'),
          gt(priceReports.reportedAt, new Date(now.getTime() - 30 * DAY_MS)),
        ),
      );
    const [allStations] = await this.db
      .select({ total: countDistinct(priceReports.stationId) })
      .from(priceReports)
      .where(
        and(
          eq(priceReports.reporterUserId, userId),
          eq(priceReports.source, 'usuario'),
        ),
      );
    const [annulled] = await this.db
      .select({ total: count() })
      .from(priceReports)
      .innerJoin(
        priceModerationCaseReports,
        eq(priceModerationCaseReports.reportId, priceReports.id),
      )
      .innerJoin(
        priceModerationDecisions,
        eq(priceModerationDecisions.caseId, priceModerationCaseReports.caseId),
      )
      .where(
        and(
          eq(priceReports.reporterUserId, userId),
          eq(priceModerationDecisions.decision, 'anulado'),
          gt(
            priceModerationDecisions.decidedAt,
            new Date(now.getTime() - 90 * DAY_MS),
          ),
        ),
      );

    const reliable =
      trust.trusted && trust.accepted >= reliableMin && annulled.total === 0;
    const level = reliable
      ? 'informante_confiavel'
      : trust.trusted
        ? 'colaborador'
        : 'iniciante';

    let nextLevel: Contribution['nextLevel'] = null;
    if (level === 'iniciante') {
      const minDays = await this.parameters.get(
        'price.trusted_min_account_days',
      );
      const minAccepted = await this.parameters.get(
        'price.trusted_min_accepted_reports',
      );
      const parts: string[] = [];
      const daysLeft = Math.ceil(minDays - trust.ageDays);
      if (daysLeft > 0) {
        parts.push(
          daysLeft === 1
            ? 'mais 1 dia de conta'
            : `mais ${daysLeft} dias de conta`,
        );
      }
      const reportsLeft = minAccepted - trust.accepted;
      if (reportsLeft > 0) {
        parts.push(
          reportsLeft === 1
            ? '1 preço aceito'
            : `${reportsLeft} preços aceitos`,
        );
      }
      nextLevel = {
        level: 'colaborador',
        missing: parts.length > 0 ? `Falta ${parts.join(' e ')}.` : 'Quase lá.',
      };
    } else if (level === 'colaborador') {
      const left = reliableMin - trust.accepted;
      nextLevel = {
        level: 'informante_confiavel',
        missing:
          left > 0
            ? `Faltam ${left} preços aceitos.`
            : 'Nenhum informe anulado nos últimos 90 dias.',
      };
    }

    return {
      level,
      acceptedReports: trust.accepted,
      reportsLast30Days: recent?.total ?? 0,
      stationsHelped: allStations?.total ?? 0,
      nextLevel,
    };
  }

  private async assertStation(stationId: string) {
    const [station] = await this.db
      .select({
        id: stations.id,
        mode: stations.displayMode,
        active: stations.active,
      })
      .from(stations)
      .where(eq(stations.id, stationId));
    if (!station || !station.active || station.mode === 'oculto') {
      throw new NotFoundException('Posto não encontrado.');
    }
  }
}
