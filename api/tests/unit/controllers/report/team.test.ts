import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';

import { Fake } from '../../../support/fake.js';

import type { FakeReply } from '../../../support/fake.js';
import type { ReportTeamBody } from '@/controllers/report/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { TeamReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
const EMPLOYEE_ID = '00000000-0000-4000-8000-0000000000c1';
const REPORT: TeamReport = {
  from: 1,
  granularity: 'week',
  kpis: {
    active_members: 0,
    average_daily_ms: 0,
    late_days: 0,
    lateness_rate: 0,
    member_count: 0,
    overtime_ms: 0,
    worked_ms: 0,
  },
  members: [],
  object: 'team_report',
  series: [],
  team_id: TEAM_ID,
  to: 2,
};

const realService = { ...(await import('@/services/report/index.js')) };
const realMembership = { ...(await import('@/utils/membership.js')) };
const svc = {
  team: mock((_params: unknown) => Promise.resolve({ report: REPORT })),
  user: mock(() => Promise.reject(new Error('unused'))),
};
const teams = mock((_userId: string) => Promise.resolve([] as string[]));
await mock.module('@/services/report/index.js', () => ({ ...realService, reportService: svc }));
await mock.module('@/utils/membership.js', () => ({
  ...realMembership,
  Membership: { teams },
}));

afterAll(() => {
  void mock.module('@/services/report/index.js', () => realService);
  void mock.module('@/utils/membership.js', () => realMembership);
});

afterEach(() => {
  mock.clearAllMocks();
  teams.mockImplementation(() => Promise.resolve([]));
});

const { team } = await import('@/controllers/report/team.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<{ report: TeamReport }> }>;
type Req = FastifyRequest<{ Body: ReportTeamBody }>;

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

const run = async (caller: Actor | undefined) => {
  const reply = Fake.reply();
  const body: ReportTeamBody = { from: 1, granularity: 'week', team_id: TEAM_ID, to: 2 };
  await team(Fake.request({ actor: caller, body }) as Req, reply as unknown as Rep);

  return reply as unknown as FakeReply;
};

describe('report.controller.team', () => {
  it('lets a manager read a team they manage with the manager filter', async () => {
    const reply = await run(actor('manager', MANAGER_ID));
    expect(reply.payload).toMatchObject({
      data: { report: { object: 'team_report' } },
      event: { code: 'report.team.generated', payload: { actor: MANAGER_ID, team_id: TEAM_ID } },
    });
    expect(svc.team).toHaveBeenCalledWith({
      from: 1,
      granularity: 'week',
      manager_id: MANAGER_ID,
      team_id: TEAM_ID,
      to: 2,
    });
  });

  it('lets an admin read any team without a manager filter', async () => {
    await run(actor('admin', ADMIN_ID));
    expect(svc.team).toHaveBeenCalledWith({
      from: 1,
      granularity: 'week',
      manager_id: undefined,
      team_id: TEAM_ID,
      to: 2,
    });
  });

  it('forbids an employee who belongs to the team', async () => {
    teams.mockImplementation(() => Promise.resolve([TEAM_ID]));
    const error = await caught(run(actor('employee', EMPLOYEE_ID)));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.team).not.toHaveBeenCalled();
  });

  it('hides the team from an employee outside of it', async () => {
    const error = await caught(run(actor('employee', EMPLOYEE_ID)));
    expect(error.code).toBe('report.team.not.found');
    expect(error.status).toBe(404);
    expect(svc.team).not.toHaveBeenCalled();
  });

  it('keeps a not found from the service as 404', async () => {
    const { ReportTeamNotFoundError } = await import('@/lib/errors/domains/report.js');
    svc.team.mockImplementationOnce(() => Promise.reject(ReportTeamNotFoundError()));
    const error = await caught(run(actor('manager', MANAGER_ID)));
    expect(error.code).toBe('report.team.not.found');
    expect(error.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const error = await caught(run(undefined));
    expect(error.code).toBe('token.authentication.failed');
  });

  it('wraps service failures', async () => {
    const failure = new Error('boom');
    svc.team.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actor('admin', ADMIN_ID)));
    expect(error.code).toBe('report.team.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('report.controller.team');
  });
});
