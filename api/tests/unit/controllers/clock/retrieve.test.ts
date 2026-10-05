import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, ADMIN_ID, caught, EMPLOYEE_ID, MANAGER_ID, MISSING_ID, OTHER_ID } from '../../services/clock/support.js';
import { installClockService, installMembership } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { ClockResponse, RetrieveParams } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installClockService();
const membership = await installMembership();
const { managed } = membership;
const { directory, sample, svc } = harness;

afterAll(() => {
  harness.restore();
  membership.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
  managed.clear();
});

const { retrieve } = await import('@/controllers/clock/retrieve.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>;
type Req = FastifyRequest<{ Params: RetrieveParams }>;

const CLOCK = '00000000-0000-4000-8000-0000000000f9';

const run = async (actor: Actor | undefined, id: string = CLOCK) => {
  const reply: FakeReply = Fake.reply();
  await retrieve(Fake.request({ actor, params: { id } }) as Req, reply as unknown as Rep);

  return reply;
};

describe('clock.controller.retrieve', () => {
  it('lets the owner read the clock', async () => {
    directory.set(CLOCK, sample(EMPLOYEE_ID));
    const reply = await run(actorOf('employee'));
    expect(reply.payload).toMatchObject({
      data: { clock: { id: CLOCK } },
      event: { code: 'clock.retrieved', payload: { actor: EMPLOYEE_ID, clock_id: CLOCK } },
    });
  });

  it('lets an admin read any clock', async () => {
    directory.set(CLOCK, sample(OTHER_ID));
    const reply = await run(actorOf('admin'));
    expect(reply.payload).toMatchObject({ data: { clock: { id: CLOCK } } });
  });

  it('lets a manager read the clock of a managed user and their own', async () => {
    directory.set(CLOCK, sample(OTHER_ID));
    managed.add(OTHER_ID);
    expect((await run(actorOf('manager'))).payload).toMatchObject({ data: { clock: { id: CLOCK } } });
    directory.set(CLOCK, sample(MANAGER_ID));
    expect((await run(actorOf('manager'))).payload).toMatchObject({ data: { clock: { id: CLOCK } } });
  });

  it('reports the clock of an unmanaged user as not found to a manager', async () => {
    directory.set(CLOCK, sample(OTHER_ID));
    const error = await caught(run(actorOf('manager')));
    expect(error.code).toBe('clock.not.found');
    expect(error.status).toBe(404);
  });

  it('reports the clock of someone else as not found to an employee', async () => {
    directory.set(CLOCK, sample(OTHER_ID));
    const error = await caught(run(actorOf('employee')));
    expect(error.code).toBe('clock.not.found');
    expect(error.status).toBe(404);
  });

  it('keeps the 404 raised by the service', async () => {
    const error = await caught(run(actorOf('admin'), MISSING_ID));
    expect(error.code).toBe('clock.not.found');
    expect(error.status).toBe(404);
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(run(undefined));
    expect(error.code).toBe('token.authentication.failed');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.retrieve.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin')));
    expect(error.code).toBe('clock.retrieve.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.retrieve');
  });
});
