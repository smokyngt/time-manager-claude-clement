import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq } from '../../../helpers/fixtures.js';
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

import type { InBody } from '@/controllers/clock/index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { clockIn } = await import('@/controllers/clock/in.js');
const { clockOut } = await import('@/controllers/clock/out.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<Clock> }>;

describe('clock.controller.in', () => {
  it('clocks in the caller with the note and replies with the event', async () => {
    const { fake, reply } = makeReply<Rep>();
    const actor = makeActor('employee');
    await clockIn(
      makeReq<FastifyRequest<{ Body: InBody }>>({ actor, body: { note: 'hi' } }),
      reply,
    );
    expect(svc.in).toHaveBeenCalledWith({ actor, note: 'hi' });
    expect(fake.sent).toMatchObject({ data: { object: 'clock' }, event: 'clock.in' });
  });

  it('lets managers and admins clock in too', async () => {
    for (const role of ['manager', 'admin'] as const) {
      const { reply } = makeReply<Rep>();
      await clockIn(
        makeReq<FastifyRequest<{ Body: InBody }>>({ actor: makeActor(role), body: {} }),
        reply,
      );
    }
    expect(svc.in).toHaveBeenCalledTimes(2);
  });

  it('requires authentication', async () => {
    const { reply } = makeReply<Rep>();
    const error = await caught(
      clockIn(makeReq<FastifyRequest<{ Body: InBody }>>({ actor: null, body: {} }), reply),
    );
    expect(error.code).toBe('UNAUTHORIZED');
    expect(svc.in).not.toHaveBeenCalled();
  });

  it('keeps the 409 conflict raised by the service', async () => {
    const { ClockConflictError } = await import('@/lib/errors/domains/clock.js');
    svc.in.mockImplementationOnce(() => Promise.reject(ClockConflictError()));
    const { reply } = makeReply<Rep>();
    const error = await caught(
      clockIn(
        makeReq<FastifyRequest<{ Body: InBody }>>({ actor: makeActor('employee'), body: {} }),
        reply,
      ),
    );
    expect(error.code).toBe('CLOCK_CONFLICT');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.in.mockImplementationOnce(() => Promise.reject(failure));
    const { reply } = makeReply<Rep>();
    const error = await caught(
      clockIn(
        makeReq<FastifyRequest<{ Body: InBody }>>({ actor: makeActor('employee'), body: {} }),
        reply,
      ),
    );
    expect(error.code).toBe('CLOCK_IN_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.in');
  });
});

describe('clock.controller.out', () => {
  it('clocks out the caller and replies with the event', async () => {
    const { fake, reply } = makeReply<Rep>();
    const actor = makeActor('employee');
    await clockOut(
      makeReq<FastifyRequest<{ Body: InBody }>>({ actor, body: { note: 'bye' } }),
      reply,
    );
    expect(svc.out).toHaveBeenCalledWith({ actor, note: 'bye' });
    expect(fake.sent).toMatchObject({ data: { object: 'clock' }, event: 'clock.out' });
  });

  it('requires authentication', async () => {
    const { reply } = makeReply<Rep>();
    const error = await caught(
      clockOut(makeReq<FastifyRequest<{ Body: InBody }>>({ actor: null, body: {} }), reply),
    );
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('keeps the 409 conflict raised by the service', async () => {
    const { ClockConflictError } = await import('@/lib/errors/domains/clock.js');
    svc.out.mockImplementationOnce(() => Promise.reject(ClockConflictError()));
    const { reply } = makeReply<Rep>();
    const error = await caught(
      clockOut(
        makeReq<FastifyRequest<{ Body: InBody }>>({ actor: makeActor('employee'), body: {} }),
        reply,
      ),
    );
    expect(error.code).toBe('CLOCK_CONFLICT');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.out.mockImplementationOnce(() => Promise.reject(failure));
    const { reply } = makeReply<Rep>();
    const error = await caught(
      clockOut(
        makeReq<FastifyRequest<{ Body: InBody }>>({ actor: makeActor('employee'), body: {} }),
        reply,
      ),
    );
    expect(error.code).toBe('CLOCK_OUT_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.out');
  });
});
