import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  caught,
  EMPLOYEE_ID,
  makeActor,
  makeReply,
  makeReq,
  OTHER_ID,
} from '../../../helpers/fixtures.js';

import type { UserBody } from '@/controllers/report/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { UserReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const real = { ...(await import('@/services/report/index.js')) };
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
const svc = {
  team: mock(() => Promise.reject(new Error('unused'))),
  user: mock((_params: unknown) => Promise.resolve({ report: REPORT })),
};
await mock.module('@/services/report/index.js', () => ({ ...real, reportService: svc }));

afterAll(() => {
  void mock.module('@/services/report/index.js', () => real);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { user } = await import('@/controllers/report/user.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<UserReport> }>;
type Req = FastifyRequest<{ Body: UserBody }>;

const run = async (actor: Actor | null, userId: string) => {
  const { fake, reply } = makeReply<Rep>();
  const body: UserBody = { from: 1, granularity: 'day', to: 2, user_id: userId };
  await user(makeReq<Req>({ actor, body }), reply);
  return fake;
};

describe('report.controller.user', () => {
  it('lets an employee read their own report', async () => {
    const fake = await run(makeActor('employee'), EMPLOYEE_ID);
    expect(fake.sent).toMatchObject({
      data: { object: 'user_report' },
      event: 'report.user.generated',
    });
    expect(svc.user).toHaveBeenCalledTimes(1);
  });

  it('forbids an employee from reading someone else without touching the service', async () => {
    const error = await caught(run(makeActor('employee'), OTHER_ID));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.user).not.toHaveBeenCalled();
  });

  it('delegates fine grained authorization to the service for managers', async () => {
    await run(makeActor('manager'), OTHER_ID);
    expect(svc.user).toHaveBeenCalledTimes(1);
  });

  it('rejects an unauthenticated request', async () => {
    const error = await caught(run(null, EMPLOYEE_ID));
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('wraps service failures and keeps the code', async () => {
    svc.user.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const error = await caught(run(makeActor('admin'), OTHER_ID));
    expect(error.code).toBe('REPORT_USER_ERROR');
    expect(error.metadata['route']).toBe('report.controller.user');
  });
});
