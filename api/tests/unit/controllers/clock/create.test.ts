import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, ADMIN_ID, caught, OTHER_ID } from '../../services/clock/support.js';
import { installClockService, installMembership } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { ClockResponse, CreateBody } from '@/controllers/clock/index.js';
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

const { create } = await import('@/controllers/clock/create.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>;
type Req = FastifyRequest<{ Body: CreateBody }>;

const body: CreateBody = {
  clocked_in_at: 1_700_000_000_000,
  clocked_out_at: 1_700_028_800_000,
  user_id: OTHER_ID,
};

const run = async (actor: Actor | undefined) => {
  const reply: FakeReply = Fake.reply();
  await create(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

describe('clock.controller.create', () => {
  it('lets an admin create a clock for anyone', async () => {
    const reply = await run(actorOf('admin'));
    expect(svc.create).toHaveBeenCalledTimes(1);
    expect(reply.payload).toMatchObject({
      data: { clock: { source: 'manual', user_id: OTHER_ID } },
      event: { code: 'clock.created', payload: { actor: ADMIN_ID } },
    });
  });

  it('lets a manager create a clock for a managed user', async () => {
    managed.add(OTHER_ID);
    const reply = await run(actorOf('manager'));
    expect(reply.payload).toMatchObject({ data: { clock: { user_id: OTHER_ID } } });
  });

  it('forbids a manager from creating a clock for an unmanaged user', async () => {
    const error = await caught(run(actorOf('manager')));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('forbids employees', async () => {
    const error = await caught(run(actorOf('employee')));
    expect(error.code).toBe('unauthorized');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(run(undefined));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('keeps an overlap raised by the service', async () => {
    const { ClockOverlapError } = await import('@/lib/errors/domains/clock.js');
    svc.create.mockImplementationOnce(() => Promise.reject(ClockOverlapError()));
    const error = await caught(run(actorOf('admin')));
    expect(error.code).toBe('clock.overlap');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.create.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin')));
    expect(error.code).toBe('clock.create.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.create');
  });

});
