import { Inject, Injectable } from '@nestjs/common';
import {
  CLAIM_ORIGINS,
  type AdhesionDashboard,
  type AdhesionDashboardQuery,
  type ClaimOrigin,
  type DashboardGranularity,
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

  async adhesion(query: AdhesionDashboardQuery): Promise<AdhesionDashboard> {
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

    const one = async <T>(q: SQL): Promise<T> =>
      (await this.db.execute(q)).rows[0] as T;
    const many = async <T>(q: SQL): Promise<T[]> =>
      (await this.db.execute(q)).rows as T[];

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
}
