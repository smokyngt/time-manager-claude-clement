import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';

import { Fake } from '../../../support/fake.js';

import type { FakeReply } from '../../../support/fake.js';
import type { UserBody } from '@/controllers/report/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { UserReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
const EMPLOYEE_ID = '00000000-0000-4000-8000-0000000000c1';
const OTHER_ID = '00000000-0000-4000-8000-0000000000c2';
const REPORT: UserReport = {
  from: 1,
  granularity: 'day',
  kpis: {
    average_daily_ms: 0,
    days_worked: 0,
    late_days: 0,
    lateness_rate: 0,
    overtime_ms: 0,
    target_ms: 0,
    worked_ms: 0,
  },
  object: 'user_report',
  series: [],
  to: 2,
  user_id: EMPLOYEE_ID,
};

const realService = { ...(await import('@/services/report/index.js')) };
const realMembership = { ...(await import('@/utils/membership.js')) };
const svc = {
  team: mock(() => Promise.reject(new Error('unused'))),
  user: mock((_params: unknown) => Promise.resolve({ report: REPORT })),
};
const reaches = mock((_actor: unknown, _userId: string) => Promise.resolve(true));
await mock.module('@/services/report/index.js', () => ({ ...realService, reportService: svc }));
await mock.module('@/utils/membership.js', () => ({
  ...realMembership,
  Membership: { reaches },
}));

afterAll(() => {
  void mock.module('@/services/report/index.js', () => realService);
  void mock.module('@/utils/membership.js', () => realMembership);
});

afterEach(() => {
  mock.clearAllMocks();
  reaches.mockImplementation(() => Promise.resolve(true));
});

const { user } = await import('@/controllers/report/user.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<{ report: UserReport }> }>;
type Req = FastifyRequest<{ Body: UserBody }>;

const actor = (role: Actor['role'], id: string): Actor => ({ id, role, team_ids: [] });

const caught = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new TypeError('expected the promise to reject');
};

const run = async (caller: Actor | undefined, userId: string) => {
  const reply = Fake.reply();
  const body: UserBody = { from: 1, granularity: 'day', to: 2, user_id: userId };
  await user(Fake.request({ actor: caller, body }) as Req, reply as unknown as Rep);

  return reply as unknown as FakeReply;
};

describe('report.controller.user', () => {
  it('lets an employee read their own report', async () => {
    const reply = await run(actor('employee', EMPLOYEE_ID), EMPLOYEE_ID);
    expect(reply.payload).toMatchObject({
      data: { report: { object: 'user_report' } },
      event: { code: 'report.user.generated', payload: { actor: EMPLOYEE_ID } },
    });
    expect(svc.user).toHaveBeenCalledWith({
      from: 1,
      granularity: 'day',
      to: 2,
      user_id: EMPLOYEE_ID,
    });
  });

  it('lets a manager read a managed user', async () => {
    await run(actor('manager', MANAGER_ID), OTHER_ID);
    expect(reaches).toHaveBeenCalledTimes(1);
    expect(svc.user).toHaveBeenCalledTimes(1);
  });

  it('hides an out-of-scope user behind a 404 without touching the service', async () => {
    reaches.mockImplementation(() => Promise.resolve(false));
    const error = await caught(run(actor('employee', EMPLOYEE_ID), OTHER_ID));
    expect(error.code).toBe('report.user.not.found');
    expect(error.status).toBe(404);
    expect(svc.user).not.toHaveBeenCalled();
  });

  it('keeps a not found from the service as 404', async () => {
    const { ReportUserNotFoundError } = await import('@/lib/errors/domains/report.js');
    svc.user.mockImplementationOnce(() => Promise.reject(ReportUserNotFoundError()));
    const error = await caught(run(actor('admin', ADMIN_ID), OTHER_ID));
    expect(error.code).toBe('report.user.not.found');
    expect(error.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const error = await caught(run(undefined, EMPLOYEE_ID));
    expect(error.code).toBe('token.authentication.failed');
  });

  it('wraps service failures', async () => {
    const failure = new Error('boom');
    svc.user.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actor('admin', ADMIN_ID), OTHER_ID));
    expect(error.code).toBe('report.user.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('report.controller.user');
  });
});
