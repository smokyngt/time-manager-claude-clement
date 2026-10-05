import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq, OTHER_ID } from '../../../helpers/fixtures.js';
import { installClockService, installMembership } from './harness.js';

const clocks = await installClockService();
const membership = await installMembership();
const { directory, svc } = clocks;
const { managed } = membership;

afterAll(() => {
  clocks.restore();
  membership.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
  managed.clear();
});

import type { ListBody, ListResponse } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { list } = await import('@/controllers/clock/list.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>;
type Req = FastifyRequest<{ Body: ListBody }>;

const THIRD_ID = '00000000-0000-4000-8000-0000000000c3';

const run = async (actor: Actor | null, body: ListBody) => {
  const { fake, reply } = makeReply<Rep>();
  await list(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const lastParams = (): Record<string, unknown> =>
  (svc.list.mock.calls as unknown as [Record<string, unknown>][])[0]?.[0] ?? {};

describe('clock.controller.list', () => {
  it('leaves an admin unrestricted and parses the date bounds', async () => {
    const fake = await run(makeActor('admin'), {
      from: '2026-01-01T00:00:00.000Z',
      open: false,
      to: 1_800_000_000_000,
    });
    expect(fake.sent).toMatchObject({ data: { items: [], total: 0 }, event: 'clock.listed' });
    expect(lastParams()).toMatchObject({
      filters: { from: Date.UTC(2026, 0, 1), open: false, to: 1_800_000_000_000 },
      limit: 25,
      order: 'desc',
    });
    expect((lastParams()['filters'] as Record<string, unknown>)['user_ids']).toBeUndefined();
  });

  it('keeps the user ids an admin asks for', async () => {
    await run(makeActor('admin'), { user_ids: [OTHER_ID] });
    expect(lastParams()).toMatchObject({ filters: { user_ids: [OTHER_ID] } });
  });

  it('forces an employee to their own clocks whatever they ask for', async () => {
    const actor = makeActor('employee');
    await run(actor, { limit: 5, user_ids: [OTHER_ID] });
    expect(lastParams()).toMatchObject({ filters: { user_ids: [actor.id] }, limit: 5 });
    expect(svc.list).toHaveBeenCalledTimes(1);
  });

  it('restricts a manager to themselves and their managed users', async () => {
    const actor = makeActor('manager');
    managed.add(OTHER_ID);
    await run(actor, {});
    expect(lastParams()).toMatchObject({ filters: { user_ids: [actor.id, OTHER_ID] } });
  });

  it('intersects the requested ids for a manager', async () => {
    const actor = makeActor('manager');
    managed.add(OTHER_ID);
    await run(actor, { user_ids: [OTHER_ID, THIRD_ID] });
    expect(lastParams()).toMatchObject({ filters: { user_ids: [OTHER_ID] } });
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, {}));
    expect(error.code).toBe('UNAUTHORIZED');
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.list.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('admin'), {}));
    expect(error.code).toBe('CLOCK_LIST_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.list');
  });
});
