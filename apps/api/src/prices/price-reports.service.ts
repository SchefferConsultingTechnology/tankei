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
  roleCan,
} from '@tankei/shared';
import { and, count, eq, gt, inArray, ne, or } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import { priceReports, stationFuels, stations } from '../database/schema';
import { ParametersService } from '../parameters/parameters.service';
import { AccessService } from '../organizations/access.service';
import { PriceReferencesService } from './price-references.service';
import {
  classifyReport,
  computeCurrentPrice,
  type DisplayParams,
  type ReportForDisplay,
} from './price-rules';

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
      .select({ id: stations.id, state: stations.state })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.active, true)));
    if (!station) throw new NotFoundException('Posto não encontrado.');

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

    if (!request.confirmed && !request.promotion) {
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
  ): Promise<Map<string, CurrentPrice[]>> {
    const result = new Map<string, CurrentPrice[]>();
    if (stationIds.length === 0) return result;

    const params = await this.displayParams();
    const since = new Date(now.getTime() - params.hideAfterDays * DAY_MS);
    const rows = await this.db
      .select()
      .from(priceReports)
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
    for (const row of rows) {
      const key = `${row.stationId}|${row.fuelType}`;
      groups.set(key, [...(groups.get(key) ?? []), toDisplay(row)]);
    }

    for (const stationId of stationIds) {
      const prices: CurrentPrice[] = [];
      for (const fuelType of FUEL_TYPES) {
        const reports = groups.get(`${stationId}|${fuelType}`);
        const current = reports && computeCurrentPrice(reports, now, params);
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
        });
      }
      result.set(stationId, prices);
    }
    return result;
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
    };
  }
}

function toDisplay(row: typeof priceReports.$inferSelect): ReportForDisplay {
  return {
    price: row.price,
    source: row.source,
    status: row.status,
    reporterUserId: row.reporterUserId,
    reportedAt: row.reportedAt,
    promotion:
      row.promotionLabel && row.promotionStartsAt && row.promotionEndsAt
        ? {
            label: row.promotionLabel,
            startsAt: row.promotionStartsAt,
            endsAt: row.promotionEndsAt,
          }
        : null,
  };
}
