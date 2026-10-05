import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import {
  ReportInvalidError,
  ReportTeamError,
  ReportTeamNotFoundError,
} from '@/lib/errors/domains/report.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { Kpi } from '@/utils/kpi.js';

import { ReportQuery } from './query.js';

import type { TeamParams, TeamResponse } from './index.js';

/**
 * @route report.service.team
 * @param {TeamParams} params
 * @returns {Promise<TeamResponse>}
 * @throws {ReportInvalidError | ReportTeamError | ReportTeamNotFoundError}
 */
export const team = async (params: TeamParams): Promise<TeamResponse> => {
  try {
    const { from, granularity, manager_id: managerId, team_id: teamId, to } = params;
    if (!Kpi.valid(from, to)) {
      throw ReportInvalidError({
        metadata: { from, route: 'report.service.team', team_id: teamId, to },
      });
    }
    const filters = [eq(teams.id, teamId)];
    if (managerId !== undefined) filters.push(eq(teams.manager_id, managerId));
    const [row] = await Tracing.span('db.report.team', () =>
      db
        .select({ id: teams.id })
        .from(teams)
        .where(and(...filters))
        .limit(1),
    );
    if (row === undefined) {
      throw ReportTeamNotFoundError({
        metadata: { route: 'report.service.team', team_id: teamId },
      });
    }
    const range = { from, granularity, to };
    const members = sql`
      select tm.user_id
      from team_members tm
      join users u on u.id = tm.user_id
      where tm.team_id = ${teamId}::uuid and u.archived_at is null
    `;
    const [totals, series] = await Promise.all([
      ReportQuery.totals(range, members),
      ReportQuery.series(range, members),
    ]);
    const rows = totals.map((total) => ({
      days_worked: total.days_worked,
      first_name: total.first_name,
      last_name: total.last_name,
      late_days: total.late_days,
      overtime_ms: Kpi.overtime(total.worked_ms, Kpi.target(total.weekly_hours, total.workdays)),
      user_id: total.user_id,
      worked_ms: total.worked_ms,
    }));
    const worked = rows.reduce((sum, member) => sum + member.worked_ms, 0);
    const personDays = rows.reduce((sum, member) => sum + member.days_worked, 0);
    const lateDays = rows.reduce((sum, member) => sum + member.late_days, 0);
    const overtime = rows.reduce((sum, member) => sum + member.overtime_ms, 0);

    return {
      report: {
        from,
        granularity,
        kpis: {
          active_members: rows.filter((member) => member.worked_ms > 0).length,
          average_daily_ms: Kpi.average(worked, personDays),
          late_days: lateDays,
          lateness_rate: Kpi.rate(lateDays, personDays),
          member_count: rows.length,
          overtime_ms: overtime,
          worked_ms: worked,
        },
        members: rows,
        object: 'team_report',
        series: series.map((point) => ({
          period_start: point.period_start,
          worked_ms: point.worked_ms,
        })),
        team_id: teamId,
        to,
      },
    };
  } catch (error) {
    throw ReportTeamError({ cause: error, metadata: { route: 'report.service.team' } });
  }
};
