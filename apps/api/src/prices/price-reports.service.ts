import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FUEL_LABELS,
  FUEL_TYPES,
  type CurrentPrice,
  type FuelType,
  type PriceReportRequest,
  type PriceReportResponse,
  type PromotionPrice,
  roleCan,
} from '@tankei/shared';
import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  priceModerationCaseReports,
  priceModerationDecisions,
  priceReports,
  promotions,
  stationFuels,
  stations,
  users,
} from '../database/schema';
import {
  casesOfReports,
  excludedReportIds,
  openCase,
} from '../moderation/moderation-store';
import { MailService } from '../mail/mail.service';
import { divergenceMail, moderationOpenedMail } from '../mail/templates';
import { ParametersService } from '../parameters/parameters.service';
import { stationDisplayName } from '../stations/display-name';
import { AccessService } from '../organizations/access.service';
import { PriceReferencesService } from './price-references.service';
import {
  classifyReport,
  computeCurrentPrice,
  distanceMeters,
  reportWeight,
  samePrice,
  type DisplayParams,
  type ReportForDisplay,
} from './price-rules';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface CheckedPromotionPrice extends PromotionPrice {
  status: 'valido' | 'suspeito';
  referenceId: string | null;
  deviationPct: number | null;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

const MESSAGES = {
  valido: 'Preço registrado. Obrigado!',
  suspeito:
    'Preço registrado. Como está bem diferente da média da região, ele aparece no app quando outra pessoa confirmar o valor.',
} as const;

@Injectable()
export class PriceReportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly parameters: ParametersService,
    private readonly references: PriceReferencesService,
    private readonly access: AccessService,
    private readonly mail: MailService,
  ) {}

  /**
   * Registra um informe de preço (ADR 0003 e 0006). O gestor do posto informa
   * como "posto", sem limite de quantidade e podendo criar promoções; os
   * demais informam como motorista, com limites por conta.
   */
  async report(
    user: AuthenticatedUser,
    stationId: string,
    request: PriceReportRequest,
    now = new Date(),
  ): Promise<PriceReportResponse> {
    const [station] = await this.db
      .select({
        id: stations.id,
        state: stations.state,
        displayMode: stations.displayMode,
        tradeName: stations.tradeName,
        legalName: stations.legalName,
        latitude: sql<number | null>`ST_Y(${stations.location})`,
        longitude: sql<number | null>`ST_X(${stations.location})`,
      })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.active, true)));
    if (!station || station.displayMode === 'oculto') {
      throw new NotFoundException('Posto não encontrado.');
    }
    // Preços ocultos pela administração (ADR 0028): ninguém informa.
    if (station.displayMode === 'precos_ocultos') {
      throw new UnprocessableEntityException(
        'Os preços deste posto não são exibidos no Tankei.',
      );
    }

    // Equipe do posto (ADR 0021): com permissão, o informe é "do posto";
    // sem ela (somente leitura), não informa, para não pesar como consumidor.
    const member = await this.access.roleAt(user.id, stationId);
    if (member && !roleCan(member.role, 'update_price')) {
      throw new ForbiddenException(
        'Seu papel no posto não permite atualizar preços.',
      );
    }
    const isManager = member !== null;
    const source = isManager ? 'posto' : 'usuario';
    const fuelLabel = FUEL_LABELS[request.fuelType];

    if (request.promotion) {
      await this.validatePromotion(request.promotion, isManager, now);
    }

    const sold = await this.stationSells(stationId, request.fuelType);
    if (!sold && !isManager) {
      throw new UnprocessableEntityException(
        `Este posto não vende ${fuelLabel.toLowerCase()}.`,
      );
    }

    if (!isManager) {
      await this.enforceLimits(user.id, stationId, request.fuelType, now);
    }

    // Promoção também confirma: um valor muito longe do atual costuma ser erro
    // de digitação (ex.: 3,00 em vez de 5,00), e ela vale acima dos outros preços.
    if (!request.confirmed) {
      await this.requireConfirmationIfFar(
        stationId,
        request.fuelType,
        request.price,
        now,
      );
    }

    const reference = await this.references.latest(
      request.fuelType,
      station.state,
    );
    const classification = classifyReport(
      request.price,
      reference?.averagePrice ?? null,
      Boolean(request.promotion),
      {
        normalPct: await this.parameters.get('price.reference_normal_pct'),
        maxPct: await this.parameters.get('price.reference_max_pct'),
      },
    );

    // Sinais do consumidor na entrada (ADR 0024): só sim ou não, nunca a posição.
    const signals = isManager
      ? null
      : await this.reporterSignals(user.id, station, request.position, now);

    // Rejeitados também ficam registrados, para auditoria e moderação.
    const [saved] = await this.db
      .insert(priceReports)
      .values({
        stationId,
        fuelType: request.fuelType,
        price: request.price,
        source,
        status: classification.status,
        reporterUserId: user.id,
        referenceId: reference?.id,
        referenceDeviationPct: classification.deviationPct,
        atStation: signals?.atStation ?? null,
        reporterTrusted: signals?.trusted ?? null,
        confirmationWeight: signals?.weight ?? null,
        promotionLabel: request.promotion?.label,
        promotionStartsAt: request.promotion?.startsAt,
        promotionEndsAt: request.promotion?.endsAt,
        reportedAt: now,
      })
      .returning({ id: priceReports.id });

    if (!sold && isManager) {
      await this.db
        .insert(stationFuels)
        .values({ stationId, fuelType: request.fuelType })
        .onConflictDoNothing();
    }

    if (!isManager && classification.status !== 'rejeitado') {
      const stationName = stationDisplayName(
        station.tradeName,
        station.legalName,
      );
      await this.detectBurst(stationId, stationName, request.fuelType, now);
      this.mail.background(() =>
        this.announceDivergence(
          stationId,
          stationName,
          request.fuelType,
          saved.id,
          now,
        ),
      );
    }

    if (classification.status === 'rejeitado') {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        code: 'PRICE_OUT_OF_RANGE',
        message: `O valor está muito diferente da média de ${reference?.state} para ${fuelLabel.toLowerCase()} (${money.format(reference?.averagePrice ?? 0)}). Confira o preço.`,
      });
    }
    return {
      id: saved.id,
      status: classification.status,
      message: MESSAGES[classification.status],
    };
  }

  /** Preços vigentes dos postos, por posto, na ordem dos combustíveis. */
  async currentPrices(
    stationIds: string[],
    now = new Date(),
    alsoExclude: Set<string> = new Set(),
  ): Promise<Map<string, CurrentPrice[]>> {
    const result = new Map<string, CurrentPrice[]>();
    if (stationIds.length === 0) return result;
    // Em moderação ou anulados não contam (ADR 0020).
    const excluded = await excludedReportIds(this.db, stationIds);
    // Modo de exibição de cada posto (ADR 0028).
    const modes = new Map(
      (
        await this.db
          .select({ id: stations.id, mode: stations.displayMode })
          .from(stations)
          .where(inArray(stations.id, stationIds))
      ).map((m) => [m.id, m.mode]),
    );

    const params = await this.displayParams();
    const since = new Date(now.getTime() - params.hideAfterDays * DAY_MS);
    const rows = await this.db
      .select({ report: priceReports, endedAt: promotions.endedAt })
      .from(priceReports)
      .leftJoin(promotions, eq(promotions.id, priceReports.promotionId))
      .where(
        and(
          inArray(priceReports.stationId, stationIds),
          ne(priceReports.status, 'rejeitado'),
          or(
            gt(priceReports.reportedAt, since),
            gt(priceReports.promotionEndsAt, now),
          ),
        ),
      );

    const groups = new Map<string, ReportForDisplay[]>();
    for (const { report: row, endedAt } of rows) {
      if (excluded.has(row.id) || alsoExclude.has(row.id)) continue;
      const key = `${row.stationId}|${row.fuelType}`;
      groups.set(key, [...(groups.get(key) ?? []), toDisplay(row, endedAt)]);
    }

    for (const stationId of stationIds) {
      const prices: CurrentPrice[] = [];
      for (const fuelType of FUEL_TYPES) {
        const reports = groups.get(`${stationId}|${fuelType}`);
        const mode = modes.get(stationId);
        if (mode === 'precos_ocultos' || mode === 'oculto') continue;
        const current =
          reports &&
          computeCurrentPrice(reports, now, params, {
            officialPrice: mode === 'preco_oficial',
          });
        if (!current) continue;
        prices.push({
          fuelType,
          price: current.price,
          badge: current.badge,
          stale: current.stale,
          updatedAt: current.updatedAt.toISOString(),
          promotion: current.promotion && {
            label: current.promotion.label,
            endsAt: current.promotion.endsAt.toISOString(),
          },
          divergence: current.divergence && {
            price: current.divergence.price,
            reportedAt: current.divergence.reportedAt.toISOString(),
            respondBy: current.divergence.respondBy.toISOString(),
          },
          otherValueReported: current.otherValueReported,
        });
      }
      result.set(stationId, prices);
    }
    return result;
  }

  /**
   * Preços de uma promoção cadastrada (ADR 0026), com as regras do informe
   * do posto: faixa da ANP só pelo limite máximo e confirmação de valor
   * muito diferente do atual. Valida todos antes de gravar qualquer um.
   */
  async checkPromotionPrices(
    stationId: string,
    prices: PromotionPrice[],
    confirmed: boolean,
    now = new Date(),
  ): Promise<CheckedPromotionPrice[]> {
    if (prices.length === 0) return [];
    const [station] = await this.db
      .select({ state: stations.state })
      .from(stations)
      .where(eq(stations.id, stationId));
    if (!station) throw new NotFoundException('Posto não encontrado.');

    const current = (await this.currentPrices([stationId], now)).get(stationId);
    const confirmPct = await this.parameters.get('price.variation_confirm_pct');
    const limits = {
      normalPct: await this.parameters.get('price.reference_normal_pct'),
      maxPct: await this.parameters.get('price.reference_max_pct'),
    };

    const checked: CheckedPromotionPrice[] = [];
    const far: string[] = [];
    for (const item of prices) {
      const label = FUEL_LABELS[item.fuelType];
      const reference = await this.references.latest(
        item.fuelType,
        station.state,
      );
      const classification = classifyReport(
        item.price,
        reference?.averagePrice ?? null,
        true,
        limits,
      );
      if (classification.status === 'rejeitado') {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: 'Unprocessable Entity',
          code: 'PRICE_OUT_OF_RANGE',
          message: `${label}: o valor está muito diferente da média de ${reference?.state} (${money.format(reference?.averagePrice ?? 0)}). Confira o preço.`,
        });
      }
      const now_ = current?.find((p) => p.fuelType === item.fuelType);
      if (now_) {
        const pct = (Math.abs(item.price - now_.price) / now_.price) * 100;
        if (pct > confirmPct) {
          far.push(
            `${label}: ${money.format(item.price)} é ${Math.round(pct)}% diferente do preço atual (${money.format(now_.price)}).`,
          );
        }
      }
      checked.push({
        ...item,
        status: classification.status,
        referenceId: reference?.id ?? null,
        deviationPct: classification.deviationPct,
      });
    }
    if (far.length > 0 && !confirmed) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'CONFIRMATION_REQUIRED',
        message: `${far.join(' ')} Confirme se está correto.`,
      });
    }
    return checked;
  }

  /** Grava os preços da promoção como informes do posto ligados a ela. */
  async insertPromotionPrices(
    db: Tx,
    values: {
      stationId: string;
      userId: string;
      promotionId: string;
      title: string;
      startsAt: Date;
      endsAt: Date;
      prices: CheckedPromotionPrice[];
    },
    now = new Date(),
  ): Promise<void> {
    if (values.prices.length === 0) return;
    await db.insert(priceReports).values(
      values.prices.map((p) => ({
        stationId: values.stationId,
        fuelType: p.fuelType,
        price: p.price,
        source: 'posto' as const,
        status: p.status,
        reporterUserId: values.userId,
        referenceId: p.referenceId,
        referenceDeviationPct: p.deviationPct,
        promotionId: values.promotionId,
        promotionLabel: values.title,
        promotionStartsAt: values.startsAt,
        promotionEndsAt: values.endsAt,
        reportedAt: now,
      })),
    );
    await db
      .insert(stationFuels)
      .values(
        values.prices.map((p) => ({
          stationId: values.stationId,
          fuelType: p.fuelType,
        })),
      )
      .onConflictDoNothing();
  }

  private async validatePromotion(
    promotion: NonNullable<PriceReportRequest['promotion']>,
    isManager: boolean,
    now: Date,
  ): Promise<void> {
    if (!isManager) {
      throw new ForbiddenException(
        'Só gestores do posto podem informar promoções.',
      );
    }
    if (promotion.endsAt <= now) {
      throw new BadRequestException('A promoção já terminou.');
    }
    const maxDays = await this.parameters.get('price.promotion_max_days');
    const durationMs =
      promotion.endsAt.getTime() - promotion.startsAt.getTime();
    if (durationMs > maxDays * DAY_MS) {
      throw new BadRequestException(
        `A promoção pode durar no máximo ${maxDays} dias.`,
      );
    }
  }

  private async stationSells(stationId: string, fuelType: FuelType) {
    const [row] = await this.db
      .select({ stationId: stationFuels.stationId })
      .from(stationFuels)
      .where(
        and(
          eq(stationFuels.stationId, stationId),
          eq(stationFuels.fuelType, fuelType),
        ),
      );
    return Boolean(row);
  }

  /** Limites por conta para motoristas (ADR 0006), inclusive informes rejeitados. */
  private async enforceLimits(
    userId: string,
    stationId: string,
    fuelType: FuelType,
    now: Date,
  ): Promise<void> {
    const intervalHours = await this.parameters.get(
      'price.report_min_interval_hours',
    );
    const [recent] = await this.db
      .select({ id: priceReports.id })
      .from(priceReports)
      .where(
        and(
          eq(priceReports.reporterUserId, userId),
          eq(priceReports.stationId, stationId),
          eq(priceReports.fuelType, fuelType),
          gt(
            priceReports.reportedAt,
            new Date(now.getTime() - intervalHours * HOUR_MS),
          ),
        ),
      )
      .limit(1);
    if (recent) {
      throw new HttpException(
        `Você já informou o preço de ${FUEL_LABELS[fuelType].toLowerCase()} neste posto há pouco. Tente de novo mais tarde.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const perDay = await this.parameters.get('price.reports_per_day_max');
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(priceReports)
      .where(
        and(
          eq(priceReports.reporterUserId, userId),
          gt(priceReports.reportedAt, new Date(now.getTime() - DAY_MS)),
        ),
      );
    if (total >= perDay) {
      throw new HttpException(
        'Você atingiu o limite de informes de hoje. Obrigado pela ajuda!',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Valor muito diferente do preço vigente do posto: pede que a pessoa confirme
   * (possível erro de digitação). O app reenvia com `confirmed: true`.
   */
  private async requireConfirmationIfFar(
    stationId: string,
    fuelType: FuelType,
    price: number,
    now: Date,
  ): Promise<void> {
    const current = (await this.currentPrices([stationId], now))
      .get(stationId)
      ?.find((p) => p.fuelType === fuelType);
    if (!current) return;

    const variationPct =
      (Math.abs(price - current.price) / current.price) * 100;
    const limit = await this.parameters.get('price.variation_confirm_pct');
    if (variationPct > limit) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'CONFIRMATION_REQUIRED',
        message: `O valor informado é ${Math.round(variationPct)}% diferente do preço atual (${money.format(current.price)}). Confirme se está correto.`,
        currentPrice: current.price,
      });
    }
  }

  private async displayParams(): Promise<DisplayParams> {
    return {
      confirmationWindowHours: await this.parameters.get(
        'price.confirmation_window_hours',
      ),
      confirmationsRequired: await this.parameters.get(
        'price.confirmations_required',
      ),
      staleAfterDays: await this.parameters.get('price.stale_after_days'),
      hideAfterDays: await this.parameters.get('price.hide_after_days'),
      divergenceResponseHours: await this.parameters.get(
        'price.divergence_response_hours',
      ),
    };
  }

  /**
   * Se o consumidor estava no posto, se a conta já é confiável e o peso do
   * informe na confirmação (ADR 0024).
   */
  private async reporterSignals(
    userId: string,
    station: { latitude: number | null; longitude: number | null },
    position: PriceReportRequest['position'],
    now: Date,
  ): Promise<{ atStation: boolean | null; trusted: boolean; weight: number }> {
    let atStation: boolean | null = null;
    if (position && station.latitude !== null && station.longitude !== null) {
      const meters = distanceMeters(position, {
        latitude: station.latitude,
        longitude: station.longitude,
      });
      atStation = meters <= (await this.parameters.get('price.near_station_m'));
    }

    const minDays = await this.parameters.get('price.trusted_min_account_days');
    const minAccepted = await this.parameters.get(
      'price.trusted_min_accepted_reports',
    );
    const [account] = await this.db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId));
    const ageDays = account
      ? (now.getTime() - account.createdAt.getTime()) / DAY_MS
      : 0;
    let trusted = ageDays >= minDays;
    if (trusted && minAccepted > 0) {
      const annulled = this.db
        .select({ id: priceModerationCaseReports.reportId })
        .from(priceModerationCaseReports)
        .innerJoin(
          priceModerationDecisions,
          eq(
            priceModerationDecisions.caseId,
            priceModerationCaseReports.caseId,
          ),
        )
        .where(eq(priceModerationDecisions.decision, 'anulado'));
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(priceReports)
        .where(
          and(
            eq(priceReports.reporterUserId, userId),
            eq(priceReports.source, 'usuario'),
            eq(priceReports.status, 'valido'),
            notInArray(priceReports.id, annulled),
          ),
        );
      trusted = total >= minAccepted;
    }

    const awayWeight = await this.parameters.get('price.away_weight_pct');
    return {
      atStation,
      trusted,
      weight: reportWeight(trusted, atStation, awayWeight),
    };
  }

  /**
   * Rajada (ADR 0020 e 0024): vários informes iguais e destoantes do preço
   * exibido, de contas não confiáveis ou longe do posto, em pouco tempo. Em
   * vez de mudar o preço, vão para a fila da equipe Tankei.
   */
  /**
   * Avisa o posto quando este informe abre uma divergência (ADR 0020 e 0025):
   * antes dele não havia, ou havia com outro valor. Uma vez por divergência.
   */
  private async announceDivergence(
    stationId: string,
    stationName: string,
    fuelType: FuelType,
    reportId: string,
    now: Date,
  ): Promise<void> {
    const priceOf = async (exclude: Set<string>) =>
      (await this.currentPrices([stationId], now, exclude))
        .get(stationId)
        ?.find((p) => p.fuelType === fuelType);
    const after = await priceOf(new Set());
    if (!after?.divergence) return;
    const before = await priceOf(new Set([reportId]));
    if (
      before?.divergence &&
      samePrice(before.divergence.price, after.divergence.price)
    ) {
      return;
    }
    const recipients = await this.access.recipients(stationId, 'update_price');
    this.mail.notify(
      recipients.map((r) => r.email),
      divergenceMail({
        stationId,
        stationName,
        fuelLabel: FUEL_LABELS[fuelType],
        stationPrice: after.price,
        consumerPrice: after.divergence.price,
        respondBy: new Date(after.divergence.respondBy),
      }),
    );
  }

  private async detectBurst(
    stationId: string,
    stationName: string,
    fuelType: FuelType,
    now: Date,
  ): Promise<void> {
    const windowMinutes = await this.parameters.get(
      'price.burst_window_minutes',
    );
    const minReports = await this.parameters.get('price.burst_min_reports');
    const recent = await this.db
      .select({
        id: priceReports.id,
        price: priceReports.price,
        reporterUserId: priceReports.reporterUserId,
        reporterTrusted: priceReports.reporterTrusted,
        atStation: priceReports.atStation,
      })
      .from(priceReports)
      .where(
        and(
          eq(priceReports.stationId, stationId),
          eq(priceReports.fuelType, fuelType),
          eq(priceReports.source, 'usuario'),
          ne(priceReports.status, 'rejeitado'),
          isNull(priceReports.promotionLabel),
          gt(
            priceReports.reportedAt,
            new Date(now.getTime() - windowMinutes * 60_000),
          ),
        ),
      );
    const inCase = await casesOfReports(
      this.db,
      recent.map((r) => r.id),
    );
    const weak = recent.filter(
      (r) =>
        !inCase.has(r.id) &&
        (r.reporterTrusted === false || r.atStation !== true),
    );

    const groups = new Map<number, typeof weak>();
    for (const r of weak) {
      const key = Math.round(r.price * 1000);
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    for (const group of groups.values()) {
      const people = new Set(group.map((r) => r.reporterUserId));
      if (people.size < minReports) continue;

      // Compara com o preço que valeria sem esses informes.
      const ids = new Set(group.map((r) => r.id));
      const baseline = (await this.currentPrices([stationId], now, ids))
        .get(stationId)
        ?.find((p) => p.fuelType === fuelType);
      if (!baseline || samePrice(baseline.price, group[0].price)) continue;
      const variationPct =
        (Math.abs(group[0].price - baseline.price) / baseline.price) * 100;
      if (
        variationPct <=
        (await this.parameters.get('price.variation_confirm_pct'))
      ) {
        continue;
      }
      const reason = `${people.size} informes de ${money.format(group[0].price)} em até ${windowMinutes} minutos, de contas novas ou longe do posto (preço exibido: ${money.format(baseline.price)}).`;
      await openCase(this.db, {
        kind: 'rajada',
        stationId,
        fuelType,
        openedByUserId: null,
        reason,
        reportIds: [...ids],
      });
      this.mail.notify(
        await this.mail.adminEmails(),
        moderationOpenedMail({
          kindLabel: 'Rajada de informes',
          stationName,
          fuelLabel: FUEL_LABELS[fuelType],
          reports: ids.size,
          reason,
        }),
      );
    }
  }
}

function toDisplay(
  row: typeof priceReports.$inferSelect,
  /** Promoção cadastrada encerrada antes do prazo (ADR 0026). */
  endedAt: Date | null = null,
): ReportForDisplay {
  const endsAt =
    row.promotionEndsAt && endedAt && endedAt < row.promotionEndsAt
      ? endedAt
      : row.promotionEndsAt;
  return {
    price: row.price,
    source: row.source,
    status: row.status,
    reporterUserId: row.reporterUserId,
    reportedAt: row.reportedAt,
    // Informes anteriores à regra de peso (ADR 0024) valem 1.
    weight: row.confirmationWeight ?? 1,
    promotion:
      row.promotionLabel && row.promotionStartsAt && endsAt
        ? {
            label: row.promotionLabel,
            startsAt: row.promotionStartsAt,
            endsAt,
          }
        : null,
  };
}
