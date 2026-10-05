import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq, MANAGER_ID } from '../../../helpers/fixtures.js';
import { installUserService } from '../../../helpers/user-service.js';

const harness = await installUserService();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

import type { ListBody, ListResponse } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';

const { list } = await import('@/controllers/user/list.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>;
type Req = FastifyRequest<{ Body: ListBody }>;

const run = async (actor: Actor | null, body: ListBody) => {
  const { fake, reply } = makeReply<Rep>();
  await list(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const lastParams = (): Record<string, unknown> =>
  (svc.list.mock.calls as unknown as [Record<string, unknown>][])[0]?.[0] ?? {};

describe('user.controller.list', () => {
  it('forwards filters, parsed date bounds and defaults for an admin', async () => {
    const fake = await run(makeActor('admin'), {
      created_after: '2026-01-01T00:00:00.000Z',
      created_before: 1_800_000_000_000,
      role: 'manager',
    });
    expect(fake.sent).toMatchObject({ data: { items: [], total: 0 }, event: 'user.listed' });
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
    await run(makeActor('manager'), { limit: 5 });
    expect(lastParams()).toMatchObject({ filters: { role: 'employee' }, limit: 5 });
  });

  it('forbids a manager from asking for another role', async () => {
    const error = await caught(run(makeActor('manager'), { role: 'admin' }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('forbids employees', async () => {
    const error = await caught(run(makeActor('employee'), {}));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.list.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('admin'), {}));
    expect(error.code).toBe('USER_LIST_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.controller.list');
  });

  it('scopes a manager to managed members and forwards team_id', async () => {
    await run(makeActor('manager'), { team_id: TEAM_ID });
    expect(lastParams()).toMatchObject({
      filters: { managed_by: MANAGER_ID, role: 'employee', team_id: TEAM_ID },
    });
  });

  it('does not scope an admin', async () => {
    await run(makeActor('admin'), { team_id: TEAM_ID });
    const filters = (lastParams()['filters'] ?? {}) as Record<string, unknown>;
    expect(filters['managed_by']).toBeUndefined();
    expect(filters['team_id']).toBe(TEAM_ID);
  });
});
