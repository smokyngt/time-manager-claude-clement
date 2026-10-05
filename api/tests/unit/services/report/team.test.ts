import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import {
  caught,
  EMPLOYEE_ID,
  makeActor,
  MANAGER_ID,
  MISSING_ID,
  OTHER_ID,
} from '../../../helpers/fixtures.js';

class ExecDb extends FakeDb {
  public execute(): Promise<unknown> {
    const next = this.next();

    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new ExecDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { team } = await import('@/services/report/team.js');

const FROM = 1_767_225_600_000;
const TO = FROM + 7 * 86_400_000;
const HOUR = 3_600_000;
const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';

const member = (user_id: string, overrides: Record<string, unknown> = {}) => ({
  days_worked: 4,
  first_name: 'Jane',
  last_name: 'Doe',
  late_days: 1,
  user_id,
  weekly_hours: 35,
  workdays: 5,
  worked_ms: 30 * HOUR,
  ...overrides,
});

const params = (overrides: Record<string, unknown> = {}) => ({
  actor: makeActor('manager'),
  from: FROM,
  granularity: 'week' as const,
  team_id: TEAM_ID,
  to: TO,
  ...overrides,
});

describe('report.service.team', () => {
  it('aggregates member totals into team kpis', async () => {
    fakeDb.enqueue(
      [{ manager_id: MANAGER_ID }],
      [member(OTHER_ID), member(EMPLOYEE_ID, { days_worked: 0, late_days: 0, worked_ms: 0 })],
      [{ late: 1, period_start: FROM, worked_ms: 30 * HOUR }],
    );
    const { report } = await team(params());
    expect(report.object).toBe('team_report');
    expect(report.team_id).toBe(TEAM_ID);
    expect(report.kpis).toEqual({
      active_members: 1,
      average_daily_ms: 7.5 * HOUR,
      late_days: 1,
      lateness_rate: 0.25,
      member_count: 2,
      overtime_ms: -40 * HOUR,
      worked_ms: 30 * HOUR,
    });
    expect(report.members).toHaveLength(2);
    expect(report.members[0]).toEqual({
      days_worked: 4,
      first_name: 'Jane',
      last_name: 'Doe',
      late_days: 1,
      overtime_ms: -5 * HOUR,
      user_id: OTHER_ID,
      worked_ms: 30 * HOUR,
    });
    expect(report.series).toEqual([{ period_start: FROM, worked_ms: 30 * HOUR }]);
  });

  it('returns empty kpis for a team without members', async () => {
    fakeDb.enqueue([{ manager_id: MANAGER_ID }], [], []);
    const { report } = await team(params());
    expect(report.kpis.member_count).toBe(0);
    expect(report.kpis.average_daily_ms).toBe(0);
    expect(report.kpis.lateness_rate).toBe(0);
  });

  it('lets an admin read any team', async () => {
    fakeDb.enqueue([{ manager_id: MISSING_ID }], [], []);
    const { report } = await team(params({ actor: makeActor('admin') }));
    expect(report.team_id).toBe(TEAM_ID);
  });

  it('throws FORBIDDEN for a manager of another team', async () => {
    fakeDb.enqueue([{ manager_id: MISSING_ID }]);
    const error = await caught(team(params()));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.status).toBe(403);
  });

  it('throws REPORT_TEAM_NOT_FOUND when the team does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(team(params()));
    expect(error.code).toBe('REPORT_TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('throws REPORT_INVALID on a reversed range without querying', async () => {
    const error = await caught(team(params({ from: TO, to: FROM })));
    expect(error.code).toBe('REPORT_INVALID');
    expect(error.status).toBe(400);
    expect(fakeDb.calls).toHaveLength(0);
  });

  it('throws REPORT_INVALID when the range exceeds 366 days', async () => {
    const error = await caught(team(params({ to: FROM + 367 * 86_400_000 })));
    expect(error.code).toBe('REPORT_INVALID');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(team(params()));
    expect(error.code).toBe('REPORT_TEAM_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('report.service.team');
  });
});
