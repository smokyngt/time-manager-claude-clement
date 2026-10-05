import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, caught, MANAGER_ID, TEAM_ID } from '../../services/user/support.js';
import { installUserService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { ListUsersBody, ListUsersResponse } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installUserService();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

const { list } = await import('@/controllers/user/list.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ListUsersResponse> }>;
type Req = FastifyRequest<{ Body: ListUsersBody }>;

const run = async (actor: Actor | undefined, body: ListUsersBody) => {
  const reply: FakeReply = Fake.reply();
  await list(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const lastParams = (): Record<string, unknown> =>
  (svc.list.mock.calls as unknown as [Record<string, unknown>][])[0]?.[0] ?? {};

describe('user.controller.list', () => {
  it('forwards filters, parsed date bounds and defaults for an admin', async () => {
    const reply = await run(actorOf('admin'), {
      created_after: '2026-01-01T00:00:00.000Z',
      created_before: 1_800_000_000_000,
      role: 'manager',
    });
    expect(reply.payload).toMatchObject({
      data: { items: [], more: false, next: null, total: 0 },
      event: {
        code: 'user.listed',
        payload: { actor: actorOf('admin').id, count: 0, total: 0 },
      },
    });
    expect(lastParams()).toMatchObject({
      filters: {
        created_after: Date.UTC(2026, 0, 1),
        created_before: 1_800_000_000_000,
        role: 'manager',
      },
      limit: 25,
      order: 'desc',
    });
  });

  it('restricts a manager to employees', async () => {
    await run(actorOf('manager'), { limit: 5 });
    expect(lastParams()).toMatchObject({ filters: { role: 'employee' }, limit: 5 });
  });

  it('forbids a manager from asking for another role', async () => {
    const error = await caught(run(actorOf('manager'), { role: 'admin' }));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('forbids employees', async () => {
    const error = await caught(run(actorOf('employee'), {}));
    expect(error.code).toBe('unauthorized');
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('rejects anonymous callers', async () => {
    const error = await caught(run(undefined, {}));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.list.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin'), {}));
    expect(error.code).toBe('user.list.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.controller.list');
  });

  it('scopes a manager to managed members and forwards team_id', async () => {
    await run(actorOf('manager'), { team_id: TEAM_ID });
    expect(lastParams()).toMatchObject({
      filters: { managed_by: MANAGER_ID, role: 'employee', team_id: TEAM_ID },
    });
  });

  it('does not scope an admin', async () => {
    await run(actorOf('admin'), { team_id: TEAM_ID });
    const filters = (lastParams()['filters'] ?? {}) as Record<string, unknown>;
    expect(filters['managed_by']).toBeUndefined();
    expect(filters['team_id']).toBe(TEAM_ID);
  });
});
