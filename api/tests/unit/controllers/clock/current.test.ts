import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, caught, EMPLOYEE_ID } from '../../services/clock/support.js';
import { installClockService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { CurrentResponse } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installClockService();
const { sample, svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
});

const { current } = await import('@/controllers/clock/current.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<CurrentResponse> }>;

const run = async (actor: Actor | undefined) => {
  const reply: FakeReply = Fake.reply();
  await current(Fake.request({ actor }), reply as unknown as Rep);

  return reply;
};

describe('clock.controller.current', () => {
  it('replies with the open clock of the caller', async () => {
    svc.current.mockImplementationOnce(() => Promise.resolve({ clock: sample(EMPLOYEE_ID) }));
    const reply = await run(actorOf('employee'));
    expect(reply.payload).toMatchObject({
      data: { clock: { user_id: EMPLOYEE_ID } },
      event: {
        code: 'clock.current.retrieved',
        payload: { actor: EMPLOYEE_ID, open: true },
      },
    });
  });

  it('replies with a null clock when not clocked in', async () => {
    const reply = await run(actorOf('employee'));
    expect(reply.payload).toMatchObject({
      data: { clock: null },
      event: { payload: { open: false } },
    });
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(run(undefined));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.current.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('employee')));
    expect(error.code).toBe('clock.current.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.current');
  });
});
