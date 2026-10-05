import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  caught,
  EMPLOYEE_ID,
  makeActor,
  makeReply,
  makeReq,
  MANAGER_ID,
} from '../../../helpers/fixtures.js';
import { installTeamService, TEAM_ID } from '../../services/team/fixtures.js';
import { installMembership } from './common.js';

const harness = await installTeamService();
const membership = await installMembership();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
  membership.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ListBody, ListResponse } from '@/controllers/team/index.js';

const { list } = await import('@/controllers/team/list.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>;
type Req = FastifyRequest<{ Body: ListBody }>;

const run = async (actor: Actor | null, body: ListBody) => {
  const { fake, reply } = makeReply<Rep>();
  await list(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const filters = (): Record<string, unknown> => {
  const calls = svc.list.mock.calls as unknown as [{ filters: Record<string, unknown> }][];
  return calls[0]?.[0].filters ?? {};
};

describe('team.controller.list', () => {
  it('does not restrict an admin', async () => {
    const fake = await run(makeActor('admin'), { manager_id: MANAGER_ID });
    expect(filters()['visible_to']).toBeUndefined();
    expect(filters()['manager_id']).toBe(MANAGER_ID);
    expect(fake.sent).toMatchObject({ event: 'team.listed' });
  });

  it('restricts a manager to managed and joined teams', async () => {
    await run(makeActor('manager'), {});
    expect(filters()['visible_to']).toEqual({ id: MANAGER_ID, managed: true });
  });

  it('restricts an employee to joined teams', async () => {
    await run(makeActor('employee'), {});
    expect(filters()['visible_to']).toEqual({ id: EMPLOYEE_ID, managed: false });
  });

  it('converts date bounds and applies defaults', async () => {
    await run(makeActor('admin'), { created_after: '2026-01-01T00:00:00.000Z', ids: [TEAM_ID] });
    expect(filters()['created_after']).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(filters()['ids']).toEqual([TEAM_ID]);
    expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, order: 'desc' }));
  });

  it('wraps service failures and keeps the cause', async () => {
    const failure = new Error('db down');
    svc.list.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('admin'), {}));
    expect(error.code).toBe('TEAM_LIST_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.list');
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, {}));
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
