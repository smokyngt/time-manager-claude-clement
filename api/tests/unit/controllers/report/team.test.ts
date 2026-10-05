import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq } from '../../../helpers/fixtures.js';

import type { TeamBody } from '@/controllers/report/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { TeamReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
const real = { ...(await import('@/services/report/index.js')) };
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
const svc = {
  team: mock((_params: unknown) => Promise.resolve({ report: REPORT })),
  user: mock(() => Promise.reject(new Error('unused'))),
};
await mock.module('@/services/report/index.js', () => ({ ...real, reportService: svc }));

afterAll(() => {
  void mock.module('@/services/report/index.js', () => real);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { team } = await import('@/controllers/report/team.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<TeamReport> }>;
type Req = FastifyRequest<{ Body: TeamBody }>;

const run = async (actor: Actor | null) => {
  const { fake, reply } = makeReply<Rep>();
  const body: TeamBody = { from: 1, granularity: 'week', team_id: TEAM_ID, to: 2 };
  await team(makeReq<Req>({ actor, body }), reply);
  return fake;
};

describe('report.controller.team', () => {
  it('lets a manager read a team report', async () => {
    const fake = await run(makeActor('manager'));
    expect(fake.sent).toMatchObject({
      data: { object: 'team_report' },
      event: 'report.team.generated',
    });
    expect(svc.team).toHaveBeenCalledTimes(1);
  });

  it('lets an admin read a team report', async () => {
    await run(makeActor('admin'));
    expect(svc.team).toHaveBeenCalledTimes(1);
  });

  it('forbids an employee without touching the service', async () => {
    const error = await caught(run(makeActor('employee')));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.team).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    const error = await caught(run(null));
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('wraps service failures', async () => {
    svc.team.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const error = await caught(run(makeActor('admin')));
    expect(error.code).toBe('REPORT_TEAM_ERROR');
    expect(error.metadata['route']).toBe('report.controller.team');
  });
});
