import { sql } from 'drizzle-orm';

import { vaultConfig } from '@/config/vault/index.js';
import { db } from '@/db/client.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { Kpi } from '@/utils/kpi.js';

import type { Granularity } from '@/types/entities/index.js';
import type { SQL } from 'drizzle-orm';

export type ReportRange = {
  from: number;
  granularity: Granularity;
  to: number;
};

export type SeriesRow = {
  late: number;
  period_start: number;
  worked_ms: number;
};

export type TotalsRow = {
  days_worked: number;
  first_name: string;
  last_name: string;
  late_days: number;
  user_id: string;
  weekly_hours: number;
  workdays: number;
  worked_ms: number;
};

export class ReportQuery {
  /**
   * @route report.query.series
   * @param {ReportRange} range
   * @param {SQL} members
   * @returns {Promise<SeriesRow[]>}
   */
  public static async series(range: ReportRange, members: SQL): Promise<SeriesRow[]> {
    const tz = vaultConfig.store.text('APP_TIMEZONE', 'Europe/Paris');
    const granularity = range.granularity;
    const rows = await Tracing.span('db.report.series', () =>
      db.execute<SeriesRow>(sql`
      ${ReportQuery.base(range, members, tz)},
      buckets as (
        select g.bucket
        from generate_series(
          date_trunc(${granularity}::text, (select min(day) from days)),
          date_trunc(${granularity}::text, (select max(day) from days)),
          ('1 ' || ${granularity}::text)::interval
        ) as g(bucket)
      ),
      agg as (
        select
          date_trunc(${granularity}::text, ud.day) as bucket,
          sum(ud.worked_ms) as worked_ms,
          count(*) filter (where ud.late) as late
        from ud
        group by 1
      )
      select
        (extract(epoch from (bk.bucket at time zone ${tz}::text)) * 1000)::float8 as period_start,
        coalesce(agg.worked_ms, 0)::float8 as worked_ms,
        coalesce(agg.late, 0)::int as late
      from buckets bk
      left join agg on agg.bucket = bk.bucket
      order by bk.bucket
    `),
    );

    return Array.from(rows);
  }

  /**
   * @route report.query.totals
   * @param {ReportRange} range
   * @param {SQL} members
   * @returns {Promise<TotalsRow[]>}
   */
  public static async totals(range: ReportRange, members: SQL): Promise<TotalsRow[]> {
    const tz = vaultConfig.store.text('APP_TIMEZONE', 'Europe/Paris');
    const rows = await Tracing.span('db.report.totals', () =>
      db.execute<TotalsRow>(sql`
      ${ReportQuery.base(range, members, tz)}
      select
        c.user_id,
        u.first_name,
        u.last_name,
        c.weekly_hours,
        (select count(*) from days where extract(isodow from day) < 6)::int as workdays,
        coalesce(sum(ud.worked_ms), 0)::float8 as worked_ms,
        count(ud.day)::int as days_worked,
        (count(*) filter (where ud.late))::int as late_days
      from cfg c
      join users u on u.id = c.user_id
      left join ud on ud.user_id = c.user_id
      group by c.user_id, u.first_name, u.last_name, c.weekly_hours
      order by c.user_id
    `),
    );

    return Array.from(rows);
  }

  private static base(range: ReportRange, members: SQL, tz: string): SQL {
    const now = Date.now();
    const grace = Kpi.graceMinutes * 60;

    return sql`
      with b as (
        select ${range.from}::bigint as f, ${range.to}::bigint as t, ${now}::bigint as n
      ),
      members as (${members}),
      cfg as (
        select
          m.user_id,
          coalesce(min(t.work_start), ${Kpi.defaultStart}::text) as work_start,
          coalesce(max(t.weekly_hours_target), ${Kpi.defaultWeeklyHours}::int) as weekly_hours
        from members m
        left join team_members tm on tm.user_id = m.user_id
        left join teams t on t.id = tm.team_id and t.archived_at is null
        group by m.user_id
      ),
      days as (
        select
          g.day,
          (extract(epoch from (g.day at time zone ${tz}::text)) * 1000)::bigint as day_start,
          (extract(epoch from ((g.day + interval '1 day') at time zone ${tz}::text)) * 1000)::bigint as day_end
        from b,
        generate_series(
          date_trunc('day', to_timestamp(b.f / 1000.0) at time zone ${tz}::text),
          date_trunc('day', to_timestamp((b.t - 1) / 1000.0) at time zone ${tz}::text),
          interval '1 day'
        ) as g(day)
      ),
      clips as (
        select
          c.user_id,
          c.clocked_in_at as started_at,
          greatest(c.clocked_in_at, b.f) as s,
          least(coalesce(c.clocked_out_at, b.n), b.t) as e
        from clocks c
        join members m on m.user_id = c.user_id
        cross join b
        where c.clocked_in_at < b.t and coalesce(c.clocked_out_at, b.n) > b.f
      ),
      daily as (
        select
          cl.user_id,
          d.day,
          sum(least(cl.e, d.day_end) - greatest(cl.s, d.day_start)) as worked_ms
        from clips cl
        join days d on cl.s < d.day_end and cl.e > d.day_start
        group by cl.user_id, d.day
      ),
      firsts as (
        select cl.user_id, d.day, min(cl.started_at) as first_at
        from clips cl
        join days d on cl.started_at >= d.day_start and cl.started_at < d.day_end
        cross join b
        where cl.started_at >= b.f
        group by cl.user_id, d.day
      ),
      ud as (
        select
          dl.user_id,
          dl.day,
          dl.worked_ms,
          coalesce(
            extract(epoch from (to_timestamp(f.first_at / 1000.0) at time zone ${tz}::text)::time)
              > extract(epoch from cfg.work_start::time) + ${grace}::int,
            false
          ) as late
        from daily dl
        join cfg on cfg.user_id = dl.user_id
        left join firsts f on f.user_id = dl.user_id and f.day = dl.day
      )
    `;
  }
}
