import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { ADMIN_ID, caught, EMPLOYEE_ID, makeActor, OTHER_ID } from '../../../helpers/fixtures.js';

class ExecDb extends FakeDb {
  public execute(): Promise<unknown> {
    const next = this.next();

    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

const realDb = { ...(await import('@/db/client.js')) };
const realMembership = { ...(await import('@/utils/membership.js')) };
const fakeDb = new ExecDb();
const reaches = mock((_actor: unknown, _userId: string) => Promise.resolve(true));
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
await mock.module('@/utils/membership.js', () => ({
  ...realMembership,
  Membership: { reaches },
}));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  void mock.module('@/utils/membership.js', () => realMembership);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
  reaches.mockImplementation(() => Promise.resolve(true));
});

const { user } = await import('@/services/report/user.js');

const FROM = 1_767_225_600_000;
const TO = FROM + 7 * 86_400_000;
const HOUR = 3_600_000;

const totals = (overrides: Record<string, unknown> = {}) => ({
  days_worked: 4,
  first_name: 'Jane',
  last_name: 'Doe',
  late_days: 1,
  user_id: OTHER_ID,
  weekly_hours: 35,
  workdays: 5,
  worked_ms: 30 * HOUR,
  ...overrides,
});

const params = (overrides: Record<string, unknown> = {}) => ({
  actor: makeActor('admin'),
  from: FROM,
  granularity: 'day' as const,
  to: TO,
  user_id: OTHER_ID,
  ...overrides,
});

describe('report.service.user', () => {
  it('computes kpis and the series', async () => {
    fakeDb.enqueue(
      [{ id: OTHER_ID }],
      [totals()],
      [{ late: 1, period_start: FROM, worked_ms: 8 * HOUR }],
    );
    const { report } = await user(params());
    expect(report.object).toBe('user_report');
    expect(report.user_id).toBe(OTHER_ID);
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
    fakeDb.enqueue(
      [{ id: OTHER_ID }],
      [totals({ days_worked: 0, late_days: 0, worked_ms: 0 })],
      [],
    );
    const { report } = await user(params());
    expect(report.kpis.average_daily_ms).toBe(0);
    expect(report.kpis.lateness_rate).toBe(0);
    expect(report.kpis.overtime_ms).toBe(-35 * HOUR);
    expect(report.series).toEqual([]);
  });

  it('prorates the target on the working days of the range', async () => {
    fakeDb.enqueue([{ id: OTHER_ID }], [totals({ weekly_hours: 40, workdays: 3 })], []);
    const { report } = await user(params());
    expect(report.kpis.target_ms).toBe(24 * HOUR);
  });

  it('throws REPORT_INVALID when to is not after from', async () => {
    const error = await caught(user(params({ to: FROM })));
    expect(error.code).toBe('REPORT_INVALID');
    expect(error.status).toBe(400);
  });

  it('throws REPORT_INVALID when the range exceeds 366 days', async () => {
    const error = await caught(user(params({ to: FROM + 367 * 86_400_000 })));
    expect(error.code).toBe('REPORT_INVALID');
  });

  it('throws FORBIDDEN when the actor cannot reach the user', async () => {
    reaches.mockImplementation(() => Promise.resolve(false));
    const error = await caught(user(params({ actor: makeActor('employee', EMPLOYEE_ID) })));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.status).toBe(403);
  });

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(user(params({ actor: makeActor('admin', ADMIN_ID) })));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(user(params()));
    expect(error.code).toBe('REPORT_USER_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('report.service.user');
  });
});
