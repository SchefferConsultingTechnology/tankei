import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FEATURE_LOCKED,
  STATION_FEATURES,
  VISIT_ACTIONS,
  VISIT_SOURCES,
  type DashboardGranularity,
  type SetStationFeature,
  type StationFeature,
  type StationFeatures,
  type StationVisits,
  type StationVisitsQuery,
  type VisitBatch,
} from '@tankei/shared';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  stationFeatureChanges,
  stations,
  stationVisits,
  users,
} from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { ParametersService } from '../parameters/parameters.service';

const TZ = 'America/Sao_Paulo';
const DAY_MS = 86_400_000;
/** Relógio do aparelho adiantado: tolera até 1 dia. */
const FUTURE_TOLERANCE_MS = DAY_MS;
/** Período máximo da consulta no portal. */
const MAX_PERIOD_DAYS = 400;

type Totals = {
  visits: number;
  visitors: number;
  detail_visits: number;
  price_reports: number;
  reviews: number;
};

/**
 * Visitas dos motoristas ao posto (spec 0003, ADR 0039): o app envia em lote,
 * o portal lê totais com o mínimo de anonimato, e a equipe libera o recurso
 * por posto até a assinatura existir.
 */
@Injectable()
export class VisitsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
    private readonly parameters: ParametersService,
  ) {}

  /** Grava as visitas novas; repetidas, antigas e de postos inexistentes são ignoradas. */
  async ingest(batch: VisitBatch, now = new Date()): Promise<number> {
    const maxQueueDays = await this.parameters.get('analytics.max_queue_days');
    const maxDetailMs =
      (await this.parameters.get('analytics.max_detail_seconds')) * 1000;
    const oldest = now.getTime() - maxQueueDays * DAY_MS;
    const newest = now.getTime() + FUTURE_TOLERANCE_MS;

    const fresh = batch.visits.filter((v) => {
      const at = Date.parse(v.openedAt);
      return at >= oldest && at <= newest;
    });
    if (fresh.length === 0) return 0;

    const ids = [...new Set(fresh.map((v) => v.stationId))];
    const known = new Set(
      (
        await this.db
          .select({ id: stations.id })
          .from(stations)
          .where(inArray(stations.id, ids))
      ).map((s) => s.id),
    );
    const rows = fresh
      .filter((v) => known.has(v.stationId))
      .map((v) => ({
        id: v.id,
        stationId: v.stationId,
        visitorId: v.visitorId,
        source: v.source,
        drivingMode: v.drivingMode,
        openedAt: new Date(v.openedAt),
        detailOpenedAt: v.detailOpenedAt ? new Date(v.detailOpenedAt) : null,
        detailMs:
          v.detailMs === null ? null : Math.min(v.detailMs, maxDetailMs),
        actions: [...new Set(v.actions)],
        closeReason: v.closeReason,
        receivedAt: now,
      }));
    if (rows.length === 0) return 0;

    const saved = await this.db
      .insert(stationVisits)
      .values(rows)
      .onConflictDoNothing({ target: stationVisits.id })
      .returning({ id: stationVisits.id });
    return saved.length;
  }

  // --- Recursos do plano ---

  async features(stationId: string): Promise<StationFeatures> {
    const rows = await this.db
      .selectDistinctOn([stationFeatureChanges.feature], {
        feature: stationFeatureChanges.feature,
        active: stationFeatureChanges.active,
        note: stationFeatureChanges.note,
        createdAt: stationFeatureChanges.createdAt,
        userName: users.name,
      })
      .from(stationFeatureChanges)
      .leftJoin(users, eq(users.id, stationFeatureChanges.userId))
      .where(eq(stationFeatureChanges.stationId, stationId))
      .orderBy(
        stationFeatureChanges.feature,
        desc(stationFeatureChanges.createdAt),
      );
    const byFeature = new Map(rows.map((r) => [r.feature, r]));
    return {
      features: STATION_FEATURES.map((feature) => {
        const row = byFeature.get(feature);
        return {
          feature,
          active: row?.active ?? false,
          note: row?.note ?? null,
          changedAt: row ? row.createdAt.toISOString() : null,
          changedBy: row?.userName ?? null,
        };
      }),
    };
  }

  async hasFeature(
    stationId: string,
    feature: StationFeature,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ active: stationFeatureChanges.active })
      .from(stationFeatureChanges)
      .where(
        and(
          eq(stationFeatureChanges.stationId, stationId),
          eq(stationFeatureChanges.feature, feature),
        ),
      )
      .orderBy(desc(stationFeatureChanges.createdAt))
      .limit(1);
    return row?.active ?? false;
  }

  async featuresForPortal(
    user: AuthenticatedUser,
    stationId: string,
  ): Promise<StationFeatures> {
    await this.access.assert(user, stationId, 'view');
    return this.features(stationId);
  }

  async setFeature(
    user: AuthenticatedUser,
    stationId: string,
    feature: StationFeature,
    body: SetStationFeature,
  ): Promise<StationFeatures> {
    const [station] = await this.db
      .select({ id: stations.id })
      .from(stations)
      .where(eq(stations.id, stationId));
    if (!station) throw new NotFoundException('Posto não encontrado.');
    await this.db.insert(stationFeatureChanges).values({
      stationId,
      feature,
      active: body.active,
      note: body.note || null,
      source: 'equipe',
      userId: user.id,
    });
    return this.features(stationId);
  }

  // --- Leitura no portal ---

  async forPortal(
    user: AuthenticatedUser,
    stationId: string,
    query: StationVisitsQuery,
  ): Promise<StationVisits> {
    await this.access.assert(user, stationId, 'view');
    // A equipe Tankei (admin) vê sempre; o posto, só com o recurso liberado.
    if (
      user.role !== 'admin' &&
      !(await this.hasFeature(stationId, 'visitas'))
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: FEATURE_LOCKED,
        message: 'As visitas ao posto fazem parte da assinatura do portal.',
      });
    }
    return this.stats(stationId, query);
  }

  async stats(
    stationId: string,
    query: StationVisitsQuery,
  ): Promise<StationVisits> {
    const minBucket = await this.parameters.get('analytics.min_bucket');
    const hide = (n: number | null | undefined) =>
      n === null || n === undefined || n < minBucket ? null : n;

    let { from } = query;
    const { to } = query;
    const span = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;
    if (span > MAX_PERIOD_DAYS) {
      from = new Date(Date.parse(to) - (MAX_PERIOD_DAYS - 1) * DAY_MS)
        .toISOString()
        .slice(0, 10);
    }
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
    const base: DashboardGranularity =
      days <= 31 ? 'dia' : days <= 186 ? 'semana' : 'mes';
    const start = sql`(${from}::date)::timestamp at time zone ${TZ}`;
    const end = sql`((${to}::date + 1))::timestamp at time zone ${TZ}`;
    const prevStart = sql`((${from}::date - ${days}::int))::timestamp at time zone ${TZ}`;

    const visitsIn = (a: SQL, b: SQL) => sql`
      select * from station_visits
      where station_id = ${stationId} and opened_at >= ${a} and opened_at < ${b}`;
    const totals = (a: SQL, b: SQL) => sql`
      with v as (${visitsIn(a, b)})
      select
        count(*)::int as visits,
        count(distinct visitor_id)::int as visitors,
        count(detail_opened_at)::int as detail_visits,
        (select count(distinct visit_id)::int from price_reports
          where station_id = ${stationId} and visit_id in (select id from v)) as price_reports,
        (select count(distinct visit_id)::int from reviews
          where station_id = ${stationId} and visit_id in (select id from v)) as reviews,
        (percentile_cont(0.5) within group (order by detail_ms)
          filter (where detail_ms is not null))::float / 1000 as median_detail_seconds
      from v`;

    const many = async <T>(q: SQL) => (await this.db.execute(q)).rows as T[];
    const seriesBy = (granularity: DashboardGranularity) => {
      const unit = { dia: 'day', semana: 'week', mes: 'month' }[granularity];
      return many<{ start: string; visits: number; detail_visits: number }>(sql`
          with buckets as (
            select generate_series(
              date_trunc(${unit}, ${from}::date::timestamp),
              date_trunc(${unit}, ${to}::date::timestamp),
              ('1 ' || ${unit})::interval
            ) as bucket
          ),
          v as (
            select date_trunc(${unit}, opened_at at time zone ${TZ}) as bucket, detail_opened_at
            from (${visitsIn(start, end)}) x
          )
          select to_char(b.bucket, 'YYYY-MM-DD') as start,
            count(v.bucket)::int as visits,
            count(v.detail_opened_at)::int as detail_visits
          from buckets b left join v on v.bucket = b.bucket
          group by b.bucket order by b.bucket`);
    };
    const [
      [current],
      [previous],
      baseSeries,
      bySource,
      weekdays,
      hours,
      actions,
    ] = await Promise.all([
      many<Totals & { median_detail_seconds: number | null }>(
        totals(start, end),
      ),
      many<Totals>(totals(prevStart, start)),
      seriesBy(base),
      many<{ source: string; visits: number }>(sql`
          select source, count(*)::int as visits
          from (${visitsIn(start, end)}) x group by source`),
      many<{ weekday: number; visits: number }>(sql`
          select extract(dow from opened_at at time zone ${TZ})::int as weekday,
            count(*)::int as visits
          from (${visitsIn(start, end)}) x group by 1`),
      many<{ hour: number; visits: number }>(sql`
          select (floor(extract(hour from opened_at at time zone ${TZ}) / 3) * 3)::int as hour,
            count(*)::int as visits
          from (${visitsIn(start, end)}) x group by 1`),
      many<{ action: string; visits: number }>(sql`
          select a as action, count(*)::int as visits
          from (${visitsIn(start, end)}) x, unnest(x.actions) a group by a`),
    ]);

    const hideTotals = (t: Totals) => ({
      visits: hide(t.visits),
      visitors: hide(t.visitors),
      detailVisits: hide(t.detail_visits),
      priceReports: hide(t.price_reports),
      reviews: hide(t.reviews),
    });
    const sourceMap = new Map(bySource.map((r) => [r.source, r.visits]));
    const weekdayMap = new Map(weekdays.map((r) => [r.weekday, r.visits]));
    const hourMap = new Map(hours.map((r) => [r.hour, r.visits]));

    // Com pouco movimento, quase todo dia fica abaixo do mínimo: agrupa por
    // semana (ou mês) para o gráfico continuar legível.
    let granularity = base;
    let series = baseSeries;
    const sparse = (list: typeof series) =>
      list.filter((p) => p.visits > 0 && p.visits < minBucket).length >
      list.length / 2;
    if (granularity === 'dia' && sparse(series)) {
      granularity = 'semana';
      series = await seriesBy(granularity);
    }
    if (granularity === 'semana' && sparse(series) && days > 31) {
      granularity = 'mes';
      series = await seriesBy(granularity);
    }
    const actionMap = new Map(actions.map((r) => [r.action, r.visits]));

    return {
      period: { from, to, granularity },
      minBucket,
      kpis: {
        ...hideTotals(current),
        // A mediana só aparece com visitas à ficha suficientes.
        medianDetailSeconds:
          hide(current.detail_visits) === null ||
          current.median_detail_seconds === null
            ? null
            : Math.round(current.median_detail_seconds),
        previous: hideTotals(previous),
      },
      series: series.map((p) => ({
        start: p.start,
        visits: hide(p.visits),
        detailVisits: hide(p.detail_visits),
      })),
      bySource: VISIT_SOURCES.map((source) => ({
        source,
        visits: hide(sourceMap.get(source)),
      })),
      byWeekday: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        visits: hide(weekdayMap.get(weekday)),
      })),
      byHour: Array.from({ length: 8 }, (_, band) => ({
        hour: band * 3,
        visits: hide(hourMap.get(band * 3)),
      })),
      actions: VISIT_ACTIONS.map((action) => ({
        action,
        visits: hide(actionMap.get(action)),
      })),
    };
  }
}
