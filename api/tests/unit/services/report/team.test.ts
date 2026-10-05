import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';

import { FakeDb } from '../../../support/db.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
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
const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
const MEMBER_ID = '00000000-0000-4000-8000-0000000000c2';
const IDLE_ID = '00000000-0000-4000-8000-0000000000c1';

const caught = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new TypeError('expected the promise to reject');
};

const member = (userId: string, overrides: Record<string, unknown> = {}) => ({
  days_worked: 4,
  first_name: 'Jane',
  last_name: 'Doe',
  late_days: 1,
  user_id: userId,
  weekly_hours: 35,
  workdays: 5,
  worked_ms: 30 * HOUR,
  ...overrides,
});

const params = (overrides: Record<string, unknown> = {}) => ({
  from: FROM,
  granularity: 'week' as const,
  team_id: TEAM_ID,
  to: TO,
  ...overrides,
});

describe('report.service.team', () => {
  it('aggregates member totals into team kpis', async () => {
    fakeDb.enqueue(
      [{ id: TEAM_ID }],
      [member(MEMBER_ID), member(IDLE_ID, { days_worked: 0, late_days: 0, worked_ms: 0 })],
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
      user_id: MEMBER_ID,
      worked_ms: 30 * HOUR,
    });
    expect(report.series).toEqual([{ period_start: FROM, worked_ms: 30 * HOUR }]);
  });

  it('returns empty kpis for a team without members', async () => {
    fakeDb.enqueue([{ id: TEAM_ID }], [], []);
    const { report } = await team(params());
    expect(report.kpis.member_count).toBe(0);
    expect(report.kpis.average_daily_ms).toBe(0);
    expect(report.kpis.lateness_rate).toBe(0);
  });

  it('applies the manager filter to the team lookup', async () => {
    fakeDb.enqueue([{ id: TEAM_ID }], [], []);
    await team(params({ manager_id: MANAGER_ID }));
    expect(fakeDb.calls.filter((call) => call.method === 'where')).toHaveLength(1);
  });

  it('throws report.team.not.found when the team is not visible', async () => {
    fakeDb.enqueue([]);
    const error = await caught(team(params({ manager_id: MANAGER_ID })));
    expect(error.code).toBe('report.team.not.found');
    expect(error.status).toBe(404);
  });

  it('throws report.invalid on a reversed range without querying', async () => {
    const error = await caught(team(params({ from: TO, to: FROM })));
    expect(error.code).toBe('report.invalid');
    expect(error.status).toBe(400);
    expect(fakeDb.calls).toHaveLength(0);
  });

  it('throws report.invalid when the range exceeds 366 days', async () => {
    const error = await caught(team(params({ to: FROM + 367 * 86_400_000 })));
    expect(error.code).toBe('report.invalid');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(team(params()));
    expect(error.code).toBe('report.team.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('report.service.team');
  });
});
