import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  ADMIN_ID,
  caught,
  EMPLOYEE_ID,
  makeActor,
  makeReply,
  makeReq,
  MANAGER_ID,
  MISSING_ID,
  OTHER_ID,
} from '../../../helpers/fixtures.js';
import { installClockService, installMembership, makeClock } from './harness.js';

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

import type { RetrieveParams } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { retrieve } = await import('@/controllers/clock/retrieve.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<Clock> }>;
type Req = FastifyRequest<{ Params: RetrieveParams }>;

const CLOCK = '00000000-0000-4000-8000-0000000000e1';

const run = async (actor: Actor | null, id: string) => {
  const { fake, reply } = makeReply<Rep>();
  await retrieve(makeReq<Req>({ actor, params: { id } }), reply);
  return fake;
};

describe('clock.controller.retrieve', () => {
  it('lets the owner read their clock', async () => {
    directory.set(CLOCK, makeClock(CLOCK, EMPLOYEE_ID));
    const fake = await run(makeActor('employee'), CLOCK);
    expect(fake.sent).toMatchObject({ data: { id: CLOCK }, event: 'clock.retrieved' });
  });

  it('lets an admin read any clock', async () => {
    directory.set(CLOCK, makeClock(CLOCK, OTHER_ID));
    const fake = await run(makeActor('admin'), CLOCK);
    expect(fake.sent).toMatchObject({ event: 'clock.retrieved' });
  });

  it('lets a manager read the clock of a managed user', async () => {
    directory.set(CLOCK, makeClock(CLOCK, OTHER_ID));
    managed.add(OTHER_ID);
    const fake = await run(makeActor('manager'), CLOCK);
    expect(fake.sent).toMatchObject({ event: 'clock.retrieved' });
  });

  it('forbids a manager from reading the clock of an unmanaged user', async () => {
    directory.set(CLOCK, makeClock(CLOCK, OTHER_ID));
    const error = await caught(run(makeActor('manager'), CLOCK));
    expect(error.code).toBe('FORBIDDEN');
  });

  it('forbids an employee from reading someone else', async () => {
    directory.set(CLOCK, makeClock(CLOCK, OTHER_ID));
    const error = await caught(run(makeActor('employee'), CLOCK));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.status).toBe(403);
  });

  it('answers 404 for an unknown clock', async () => {
    const error = await caught(run(makeActor('admin', ADMIN_ID), MISSING_ID));
    expect(error.code).toBe('CLOCK_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, CLOCK));
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.retrieve.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('manager', MANAGER_ID), CLOCK));
    expect(error.code).toBe('CLOCK_RETRIEVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.retrieve');
  });
});
