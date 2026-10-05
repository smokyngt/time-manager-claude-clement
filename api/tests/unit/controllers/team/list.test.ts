import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, ADMIN_ID, caught, EMPLOYEE_ID, MANAGER_ID } from '../../services/team/support.js';
import { installTeamService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { ListBody, ListResponse } from '@/controllers/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installTeamService();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

const { list } = await import('@/controllers/team/list.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>;
type Req = FastifyRequest<{ Body: ListBody }>;

const run = async (actor: Actor | undefined, body: ListBody) => {
  const reply: FakeReply = Fake.reply();
  await list(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const filters = (): Record<string, unknown> =>
  ((svc.list.mock.calls as unknown as [{ filters: Record<string, unknown> }][])[0]?.[0].filters) ?? {};

describe('team.controller.list', () => {
  it('forwards filters, parsed date bounds and defaults for an admin without visibility scope', async () => {
    const reply = await run(actorOf('admin'), {
      created_after: '2026-01-01T00:00:00.000Z',
      created_before: 1_800_000_000_000,
      manager_id: MANAGER_ID,
    });
    expect(reply.payload).toMatchObject({
      data: { items: [], more: false, next: null, total: 0 },
      event: { code: 'team.listed', payload: { actor: ADMIN_ID, count: 0, total: 0 } },
    });
    expect(filters()).toMatchObject({
      created_after: Date.UTC(2026, 0, 1),
      created_before: 1_800_000_000_000,
      manager_id: MANAGER_ID,
    });
    expect(filters()['visible_to']).toBeUndefined();
    expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, order: 'desc' }));
  });

  it('scopes a manager to managed or member teams', async () => {
    await run(actorOf('manager'), { limit: 5 });
    expect(filters()['visible_to']).toEqual({ id: MANAGER_ID, managed: true });
  });

  it('scopes an employee to member teams', async () => {
    await run(actorOf('employee'), {});
    expect(filters()['visible_to']).toEqual({ id: EMPLOYEE_ID, managed: false });
  });

  it('rejects anonymous callers', async () => {
    const error = await caught(run(undefined, {}));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.list.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin'), {}));
    expect(error.code).toBe('team.list.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.list');
  });
});
