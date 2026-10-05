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

import type { CreateBody } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { create } = await import('@/controllers/clock/create.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<Clock> }>;
type Req = FastifyRequest<{ Body: CreateBody }>;

const body: CreateBody = {
  clocked_in_at: 1_700_000_000_000,
  clocked_out_at: 1_700_028_800_000,
  user_id: OTHER_ID,
};

const run = async (actor: Actor | null) => {
  const { fake, reply } = makeReply<Rep>();
  await create(makeReq<Req>({ actor, body }), reply);
  return fake;
};

describe('clock.controller.create', () => {
  it('lets an admin create a clock for anyone', async () => {
    const actor = makeActor('admin');
    const fake = await run(actor);
    expect(svc.create).toHaveBeenCalledWith({ actor, data: body });
    expect(fake.sent).toMatchObject({ data: { source: 'manual' }, event: 'clock.created' });
  });

  it('lets a manager create a clock for a managed user', async () => {
    managed.add(OTHER_ID);
    const fake = await run(makeActor('manager'));
    expect(fake.sent).toMatchObject({ event: 'clock.created' });
  });

  it('forbids a manager from creating a clock for an unmanaged user', async () => {
    const error = await caught(run(makeActor('manager')));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('forbids employees', async () => {
    const error = await caught(run(makeActor('employee')));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const error = await caught(run(null));
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('keeps invalid and overlap errors raised by the service', async () => {
    const { ClockInvalidError, ClockOverlapError } = await import('@/lib/errors/domains/clock.js');
    svc.create.mockImplementationOnce(() => Promise.reject(ClockInvalidError()));
    const invalid = await caught(run(makeActor('admin')));
    svc.create.mockImplementationOnce(() => Promise.reject(ClockOverlapError()));
    const overlap = await caught(run(makeActor('admin')));
    expect([invalid.code, invalid.status]).toEqual(['CLOCK_INVALID', 400]);
    expect([overlap.code, overlap.status]).toEqual(['CLOCK_OVERLAP', 409]);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.create.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('admin')));
    expect(error.code).toBe('CLOCK_CREATE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.create');
  });
});
