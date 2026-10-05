import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, caught, EMPLOYEE_ID } from '../../services/clock/support.js';
import { installClockService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { ClockInBody, ClockResponse } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installClockService();
const { svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
});

const { clockIn } = await import('@/controllers/clock/in.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>;
type Req = FastifyRequest<{ Body: ClockInBody }>;

const run = async (actor: Actor | undefined, body: ClockInBody) => {
  const reply: FakeReply = Fake.reply();
  await clockIn(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

describe('clock.controller.in', () => {
  it('clocks the caller in and replies with the named clock', async () => {
    const actor = actorOf('employee');
    const reply = await run(actor, { note: 'hello' });
    expect(svc.clockIn).toHaveBeenCalledWith({ actor, note: 'hello' });
    expect(reply.payload).toMatchObject({
      data: { clock: { user_id: EMPLOYEE_ID } },
      event: {
        code: 'clock.started',
        correlation_id: 'req-test',
        payload: { actor: EMPLOYEE_ID },
      },
    });
  });

  it('keeps the 409 conflict raised by the service', async () => {
    const { ClockConflictError } = await import('@/lib/errors/domains/clock.js');
    svc.clockIn.mockImplementationOnce(() => Promise.reject(ClockConflictError()));
    const error = await caught(run(actorOf('employee'), {}));
    expect(error.code).toBe('clock.conflict');
    expect(error.status).toBe(409);
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(run(undefined, {}));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
    expect(svc.clockIn).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.clockIn.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('employee'), {}));
    expect(error.code).toBe('clock.in.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.in');
  });
});
