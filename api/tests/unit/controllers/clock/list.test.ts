import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, caught, EMPLOYEE_ID, MANAGER_ID, OTHER_ID } from '../../services/clock/support.js';
import { installClockService, installMembership } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { ListClocksBody, ListClocksResponse } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installClockService();
const membership = await installMembership();
const { managed } = membership;
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
  membership.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
  managed.clear();
});

const { list } = await import('@/controllers/clock/list.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ListClocksResponse> }>;
type Req = FastifyRequest<{ Body: ListClocksBody }>;

const run = async (actor: Actor | undefined, body: ListClocksBody = {}) => {
  const reply: FakeReply = Fake.reply();
  await list(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const filters = (): Record<string, unknown> =>
  (svc.list.mock.calls[0]?.[0] as { filters: Record<string, unknown> }).filters;

describe('clock.controller.list', () => {
  it('forces an employee onto their own clocks', async () => {
    const reply = await run(actorOf('employee'), { user_ids: [OTHER_ID] });
    expect(filters()['user_ids']).toEqual([EMPLOYEE_ID]);
    expect(reply.payload).toMatchObject({
      data: { items: [], more: false, total: 0 },
      event: { code: 'clock.listed', payload: { actor: EMPLOYEE_ID, count: 0, total: 0 } },
    });
  });

  it('limits a manager to themselves and their managed users', async () => {
    managed.add(OTHER_ID);
    await run(actorOf('manager'));
    expect([...(filters()['user_ids'] as string[])].sort()).toEqual([MANAGER_ID, OTHER_ID].sort());
  });

  it('drops requested users outside the manager scope', async () => {
    managed.add(OTHER_ID);
    await run(actorOf('manager'), { user_ids: [OTHER_ID, EMPLOYEE_ID] });
    expect(filters()['user_ids']).toEqual([OTHER_ID]);
  });

  it('lets an admin see everyone or filter by user', async () => {
    await run(actorOf('admin'));
    expect(filters()['user_ids']).toBeUndefined();
    mock.clearAllMocks();
    await run(actorOf('admin'), { user_ids: [OTHER_ID] });
    expect(filters()['user_ids']).toEqual([OTHER_ID]);
  });

  it('converts date bounds and applies defaults', async () => {
    await run(actorOf('admin'), { from: '2026-01-01T00:00:00.000Z', open: true, to: 5 });
    expect(filters()).toMatchObject({ from: 1_767_225_600_000, open: true, to: 5 });
    expect(svc.list.mock.calls[0]?.[0]).toMatchObject({ limit: 25, order: 'desc' });
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(run(undefined));
    expect(error.code).toBe('token.authentication.failed');
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.list.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin')));
    expect(error.code).toBe('clock.list.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.list');
  });

});
