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

const { user } = await import('@/services/report/user.js');

const FROM = 1_767_225_600_000;
const TO = FROM + 7 * 86_400_000;
const HOUR = 3_600_000;
const USER_ID = '00000000-0000-4000-8000-0000000000c2';

const caught = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new TypeError('expected the promise to reject');
};

const totals = (overrides: Record<string, unknown> = {}) => ({
  days_worked: 4,
  first_name: 'Jane',
  last_name: 'Doe',
  late_days: 1,
  user_id: USER_ID,
  weekly_hours: 35,
  workdays: 5,
  worked_ms: 30 * HOUR,
  ...overrides,
});

const params = (overrides: Record<string, unknown> = {}) => ({
  from: FROM,
  granularity: 'day' as const,
  to: TO,
  user_id: USER_ID,
  ...overrides,
});

describe('report.service.user', () => {
  it('computes kpis and the series', async () => {
    fakeDb.enqueue(
      [{ id: USER_ID }],
      [totals()],
      [{ late: 1, period_start: FROM, worked_ms: 8 * HOUR }],
    );
    const { report } = await user(params());
    expect(report.object).toBe('user_report');
    expect(report.user_id).toBe(USER_ID);
    expect(report.kpis).toEqual({
      average_daily_ms: 7.5 * HOUR,
      days_worked: 4,
      late_days: 1,
      lateness_rate: 0.25,
      overtime_ms: -5 * HOUR,
      target_ms: 35 * HOUR,
      worked_ms: 30 * HOUR,
    });
    expect(report.series).toEqual([{ late: 1, period_start: FROM, worked_ms: 8 * HOUR }]);
  });

  it('returns zeros when the user has no activity', async () => {
    fakeDb.enqueue([{ id: USER_ID }], [totals({ days_worked: 0, late_days: 0, worked_ms: 0 })], []);
    const { report } = await user(params());
    expect(report.kpis.average_daily_ms).toBe(0);
    expect(report.kpis.lateness_rate).toBe(0);
    expect(report.kpis.overtime_ms).toBe(-35 * HOUR);
    expect(report.series).toEqual([]);
  });

  it('prorates the target on the working days of the range', async () => {
    fakeDb.enqueue([{ id: USER_ID }], [totals({ weekly_hours: 40, workdays: 3 })], []);
    const { report } = await user(params());
    expect(report.kpis.target_ms).toBe(24 * HOUR);
  });

  it('throws report.invalid when to is not after from', async () => {
    const error = await caught(user(params({ to: FROM })));
    expect(error.code).toBe('report.invalid');
    expect(error.status).toBe(400);
    expect(fakeDb.calls).toHaveLength(0);
  });

  it('throws report.invalid when the range exceeds 366 days', async () => {
    const error = await caught(user(params({ to: FROM + 367 * 86_400_000 })));
    expect(error.code).toBe('report.invalid');
  });

  it('throws report.user.not.found when the user does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(user(params()));
    expect(error.code).toBe('report.user.not.found');
    expect(error.status).toBe(404);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(user(params()));
    expect(error.code).toBe('report.user.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('report.service.user');
  });
});
