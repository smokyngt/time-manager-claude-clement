import { eq, sql } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import {
  ReportInvalidError,
  ReportUserError,
  ReportUserNotFoundError,
} from '@/lib/errors/index.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { Kpi } from '@/utils/kpi.js';

import { ReportQuery } from './query.js';

import type { ReportUserParams, ReportUserResponse } from './index.js';

/**
 * @route report.service.user
 * @param {ReportUserParams} params
 * @returns {Promise<ReportUserResponse>}
 * @throws {ReportInvalidError | ReportUserError | ReportUserNotFoundError}
 */
export const user = async (params: ReportUserParams): Promise<ReportUserResponse> => {
  try {
    const { from, granularity, to, user_id: userId } = params;
    if (!Kpi.valid(from, to)) {
      throw ReportInvalidError({
        metadata: { from, route: 'report.service.user', to, user_id: userId },
      });
    }
    const [row] = await Tracing.span('db.report.user', () =>
      db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1),
    );
    if (row === undefined) {
      throw ReportUserNotFoundError({
        metadata: { route: 'report.service.user', user_id: userId },
      });
    }
    const range = { from, granularity, to };
    const members = sql`select ${userId}::uuid as user_id`;
    const [totals, series] = await Promise.all([
      ReportQuery.totals(range, members),
      ReportQuery.series(range, members),
    ]);
    const total = totals[0];
    const worked = total?.worked_ms ?? 0;
    const daysWorked = total?.days_worked ?? 0;
    const lateDays = total?.late_days ?? 0;
    const target = Kpi.target(total?.weekly_hours ?? Kpi.defaultWeeklyHours, total?.workdays ?? 0);

    return {
      report: {
        from,
        granularity,
        kpis: {
          average_daily_ms: Kpi.average(worked, daysWorked),
          days_worked: daysWorked,
          late_days: lateDays,
          lateness_rate: Kpi.rate(lateDays, daysWorked),
          overtime_ms: Kpi.overtime(worked, target),
          target_ms: target,
          worked_ms: worked,
        },
        object: 'user_report',
        series: series.map((point) => ({
          late: point.late,
          period_start: point.period_start,
          worked_ms: point.worked_ms,
        })),
        to,
        user_id: userId,
      },
    };
  } catch (error) {
    throw ReportUserError({ cause: error, metadata: { route: 'report.service.user' } });
  }
};
