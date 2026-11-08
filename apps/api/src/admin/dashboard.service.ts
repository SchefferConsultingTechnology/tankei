import { Inject, Injectable } from '@nestjs/common';
import {
  CLAIM_ORIGINS,
  type AdhesionDashboard,
  type AdhesionDashboardQuery,
  type ClaimOrigin,
  type DashboardGranularity,
  type EngagementDashboard,
  type EngagementDashboardQuery,
} from '@tankei/shared';
import { sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { cityDisplayName } from '../stations/display-name';

const TZ = 'America/Sao_Paulo';
const DAY_MS = 86_400_000;

/** Postos aderidos que contam como "atualizando preço": últimos 7 dias. */
const UPDATING_WINDOW_DAYS = 7;

/**
 * Dashboard de adesão (ADR 0037). Tudo calculado no banco, no fuso de
 * Brasília. Recorte opcional por UF e município do posto.
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Período, agrupamento e recorte comuns aos dashboards. */
  private window(query: AdhesionDashboardQuery) {
    const days =
      Math.round((Date.parse(query.to) - Date.parse(query.from)) / DAY_MS) + 1;
    const granularity: DashboardGranularity =
      days <= 31 ? 'dia' : days <= 186 ? 'semana' : 'mes';
    const unit = { dia: 'day', semana: 'week', mes: 'month' }[granularity];

    // Limites do período em timestamptz (meia-noite de Brasília).
    const start = sql`(${query.from}::date)::timestamp at time zone ${TZ}`;
    const end = sql`((${query.to}::date + 1))::timestamp at time zone ${TZ}`;
    const prevStart = sql`((${query.from}::date - ${days}::int))::timestamp at time zone ${TZ}`;

    const scope: SQL = sql.join(
      [
        sql`s.active`,
        query.state ? sql`s.state = ${query.state}` : sql`true`,
        query.municipality
          ? sql`s.municipality_code = ${query.municipality}`
          : sql`true`,
      ],
      sql` and `,
    );

    return { days, granularity, unit, start, end, prevStart, scope };
  }

  private async one<T>(q: SQL): Promise<T> {
    return (await this.db.execute(q)).rows[0] as T;
  }

  private async many<T>(q: SQL): Promise<T[]> {
    return (await this.db.execute(q)).rows as T[];
  }

  async adhesion(query: AdhesionDashboardQuery): Promise<AdhesionDashboard> {
    const { granularity, unit, start, end, prevStart, scope } =
      this.window(query);
    const one = <T>(q: SQL) => this.one<T>(q);
    const many = <T>(q: SQL) => this.many<T>(q);

    const [kpi, claimKpi, series, funnel, byCity, byOrigin] = await Promise.all(
      [
        one<{
          adhered_total: number;
          adhered_period: number;
          adhered_previous: number;
          stations: number;
          updating: number;
        }>(sql`
        select
          (select count(*)::int from organization_stations os join stations s on s.id = os.station_id
            where ${scope} and os.added_at < ${end}) as adhered_total,
          (select count(*)::int from organization_stations os join stations s on s.id = os.station_id
            where ${scope} and os.added_at >= ${start} and os.added_at < ${end}) as adhered_period,
          (select count(*)::int from organization_stations os join stations s on s.id = os.station_id
            where ${scope} and os.added_at >= ${prevStart} and os.added_at < ${start}) as adhered_previous,
          (select count(*)::int from stations s where ${scope}) as stations,
          (select count(distinct os.station_id)::int from organization_stations os
            join stations s on s.id = os.station_id
            join price_reports pr on pr.station_id = os.station_id
            where ${scope} and pr.source = 'posto'
              and pr.reported_at >= ${end} - make_interval(days => ${UPDATING_WINDOW_DAYS})
              and pr.reported_at < ${end}) as updating`),
        one<{
          pending: number;
          approved: number;
          rejected: number;
          avg_hours: number | null;
        }>(sql`
        select
          count(*) filter (where d.id is null)::int as pending,
          count(*) filter (where d.decision = 'aprovado' and d.decided_at >= ${start} and d.decided_at < ${end})::int as approved,
          count(*) filter (where d.decision = 'recusado' and d.decided_at >= ${start} and d.decided_at < ${end})::int as rejected,
          avg(extract(epoch from d.decided_at - c.created_at) / 3600)
            filter (where d.decision = 'aprovado' and d.decided_at >= ${start} and d.decided_at < ${end})::float as avg_hours
        from station_claims c
        join stations s on s.id = c.station_id
        left join station_claim_decisions d on d.claim_id = c.id
        where ${scope}`),
        many<{ start: string; adhered: number; cumulative: number }>(sql`
        with buckets as (
          select generate_series(
            date_trunc(${unit}, ${query.from}::date::timestamp),
            date_trunc(${unit}, ${query.to}::date::timestamp),
            ('1 ' || ${unit})::interval
          ) as bucket
        ),
        joined as (
          select date_trunc(${unit}, os.added_at at time zone ${TZ}) as bucket
          from organization_stations os join stations s on s.id = os.station_id
          where ${scope} and os.added_at >= ${start} and os.added_at < ${end}
        ),
        before as (
          select count(*)::int as n from organization_stations os join stations s on s.id = os.station_id
          where ${scope} and os.added_at < ${start}
        )
        select to_char(b.bucket, 'YYYY-MM-DD') as start,
          count(j.bucket)::int as adhered,
          ((select n from before) + sum(count(j.bucket)) over (order by b.bucket))::int as cumulative
        from buckets b left join joined j on j.bucket = b.bucket
        group by b.bucket order by b.bucket`),
        one<{ requested: number; approved: number; updating: number }>(sql`
        with requested as (
          select c.id, c.station_id, d.decision
          from station_claims c
          join stations s on s.id = c.station_id
          left join station_claim_decisions d on d.claim_id = c.id
          where ${scope} and c.created_at >= ${start} and c.created_at < ${end}
        )
        select
          count(*)::int as requested,
          count(*) filter (where decision = 'aprovado')::int as approved,
          count(distinct station_id) filter (where decision = 'aprovado' and exists (
            select 1 from price_reports pr
            where pr.station_id = requested.station_id and pr.source = 'posto'
              and pr.reported_at < ${end}
          ))::int as updating
        from requested`),
        many<{
          city: string;
          state: string;
          adhered: number;
          stations: number;
        }>(sql`
        select coalesce(m.name, s.city) as city, s.state,
          count(os.station_id)::int as adhered,
          (select count(*)::int from stations t
            where t.active and t.city = s.city and t.state = s.state) as stations
        from organization_stations os
        join stations s on s.id = os.station_id
        -- Nome oficial do IBGE, com acentos (a ANP grava sem).
        left join municipalities m on m.code = s.municipality_code
        where ${scope} and os.added_at < ${end}
        group by coalesce(m.name, s.city), s.city, s.state
        order by adhered desc, 1
        limit 10`),
        many<{ origin: ClaimOrigin; claims: number }>(sql`
        select c.origin::text as origin, count(*)::int as claims
        from station_claims c join stations s on s.id = c.station_id
        where ${scope} and c.created_at >= ${start} and c.created_at < ${end}
        group by c.origin`),
      ],
    );

    const originCount = new Map(byOrigin.map((o) => [o.origin, o.claims]));
    return {
      period: { from: query.from, to: query.to, granularity },
      kpis: {
        adheredTotal: kpi.adhered_total,
        adheredInPeriod: kpi.adhered_period,
        adheredPreviousPeriod: kpi.adhered_previous,
        stationsInScope: kpi.stations,
        pendingClaims: claimKpi.pending,
        approvedInPeriod: claimKpi.approved,
        rejectedInPeriod: claimKpi.rejected,
        avgApprovalHours:
          claimKpi.avg_hours === null
            ? null
            : Math.round(claimKpi.avg_hours * 10) / 10,
        updatingPrices: kpi.updating,
      },
      series,
      funnel: {
        requested: funnel.requested,
        approved: funnel.approved,
        updatingPrices: funnel.updating,
      },
      byCity: byCity.map((c) => ({
        ...c,
        // Sem o IBGE importado, deixa legível o nome da ANP.
        city:
          c.city === c.city.toUpperCase() ? cityDisplayName(c.city) : c.city,
      })),
      byOrigin: CLAIM_ORIGINS.map((origin) => ({
        origin,
        claims: originCount.get(origin) ?? 0,
      })),
    };
  }

  /**
   * Engajamento dos motoristas (ADR 0038): informes de preço (origem
   * "usuario") e avaliações no período, por estado ou por cidade.
   */
  async engagement(
    query: EngagementDashboardQuery,
  ): Promise<EngagementDashboard> {
    const { granularity, unit, start, end, prevStart, scope } =
      this.window(query);
    const byCity = Boolean(query.state);

    // Interações (preço de motorista ou avaliação) de um intervalo.
    const interactions = (from: SQL, to: SQL) => sql`
      select pr.station_id, pr.reporter_user_id as user_id, 'preco' as kind, pr.reported_at as at
      from price_reports pr
      where pr.source = 'usuario' and pr.reported_at >= ${from} and pr.reported_at < ${to}
      union all
      select r.station_id, r.user_id, 'avaliacao' as kind, r.created_at as at
      from reviews r
      where r.created_at >= ${from} and r.created_at < ${to}`;

    const counts = (from: SQL, to: SQL) =>
      this.one<{
        price_reports: number;
        reviews: number;
        active_users: number;
        with_prices: number;
        with_reviews: number;
        with_any: number;
      }>(sql`
        select
          count(*) filter (where i.kind = 'preco')::int as price_reports,
          count(*) filter (where i.kind = 'avaliacao')::int as reviews,
          count(distinct i.user_id)::int as active_users,
          count(distinct i.station_id) filter (where i.kind = 'preco')::int as with_prices,
          count(distinct i.station_id) filter (where i.kind = 'avaliacao')::int as with_reviews,
          count(distinct i.station_id)::int as with_any
        from (${interactions(from, to)}) i
        join stations s on s.id = i.station_id
        where ${scope}`);

    const region = byCity ? sql`coalesce(m.name, s.city)` : sql`s.state`;

    const [current, previous, scopeSize, series, regions] = await Promise.all([
      counts(start, end),
      counts(prevStart, start),
      this.one<{ n: number }>(
        sql`select count(*)::int as n from stations s where ${scope}`,
      ),
      this.many<{ start: string; price_reports: number; reviews: number }>(sql`
        with buckets as (
          select generate_series(
            date_trunc(${unit}, ${query.from}::date::timestamp),
            date_trunc(${unit}, ${query.to}::date::timestamp),
            ('1 ' || ${unit})::interval
          ) as bucket
        ),
        events as (
          select date_trunc(${unit}, i.at at time zone ${TZ}) as bucket, i.kind
          from (${interactions(start, end)}) i
          join stations s on s.id = i.station_id
          where ${scope}
        )
        select to_char(b.bucket, 'YYYY-MM-DD') as start,
          count(e.kind) filter (where e.kind = 'preco')::int as price_reports,
          count(e.kind) filter (where e.kind = 'avaliacao')::int as reviews
        from buckets b left join events e on e.bucket = b.bucket
        group by b.bucket order by b.bucket`),
      this.many<{
        name: string;
        state: string;
        stations: number;
        with_any: number;
        price_reports: number;
        reviews: number;
        active_users: number;
      }>(sql`
        with i as (${interactions(start, end)}),
        per_station as (
          select station_id,
            count(*) filter (where kind = 'preco')::int as price_reports,
            count(*) filter (where kind = 'avaliacao')::int as reviews
          from i group by station_id
        ),
        users_by_region as (
          select ${region} as name, s.state, count(distinct i.user_id)::int as active_users
          from i join stations s on s.id = i.station_id
          left join municipalities m on m.code = s.municipality_code
          where ${scope}
          group by 1, 2
        )
        select ${region} as name, s.state,
          count(*)::int as stations,
          count(ps.station_id)::int as with_any,
          coalesce(sum(ps.price_reports), 0)::int as price_reports,
          coalesce(sum(ps.reviews), 0)::int as reviews,
          coalesce(max(u.active_users), 0)::int as active_users
        from stations s
        left join municipalities m on m.code = s.municipality_code
        left join per_station ps on ps.station_id = s.id
        left join users_by_region u on u.name = ${region} and u.state = s.state
        where ${scope}
        group by 1, 2
        -- Cidades com interação primeiro; depois as maiores, sem interação
        -- (oportunidade de marketing). Estados: todos.
        order by (count(ps.station_id) > 0) desc, stations desc, 1
        limit ${byCity ? 60 : 30}`),
    ]);

    return {
      period: { from: query.from, to: query.to, granularity },
      kpis: {
        priceReports: current.price_reports,
        reviews: current.reviews,
        activeUsers: current.active_users,
        stationsInScope: scopeSize.n,
        stationsWithPrices: current.with_prices,
        stationsWithReviews: current.with_reviews,
        stationsWithAny: current.with_any,
        previous: {
          priceReports: previous.price_reports,
          reviews: previous.reviews,
          activeUsers: previous.active_users,
        },
      },
      series: series.map((p) => ({
        start: p.start,
        priceReports: p.price_reports,
        reviews: p.reviews,
      })),
      regions: {
        level: byCity ? 'cidade' : 'estado',
        rows: regions.map((r) => ({
          name:
            byCity && r.name === r.name.toUpperCase()
              ? cityDisplayName(r.name)
              : r.name,
          state: r.state,
          stations: r.stations,
          stationsWithAny: r.with_any,
          priceReports: r.price_reports,
          reviews: r.reviews,
          activeUsers: r.active_users,
        })),
      },
    };
  }
}
