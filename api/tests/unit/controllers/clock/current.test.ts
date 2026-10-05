import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq } from '../../../helpers/fixtures.js';
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

import type { CurrentResponse } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { current } = await import('@/controllers/clock/current.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<CurrentResponse> }>;

describe('clock.controller.current', () => {
  it('returns the open clock of the caller', async () => {
    const actor = makeActor('employee');
    svc.current.mockImplementationOnce(() =>
      Promise.resolve({ clock: makeClock('c', actor.id, { clocked_out_at: null }) }),
    );
    const { fake, reply } = makeReply<Rep>();
    await current(makeReq<FastifyRequest>({ actor }), reply);
    expect(svc.current).toHaveBeenCalledWith({ actor });
    expect(fake.sent).toMatchObject({ data: { clock: { id: 'c' } }, event: 'clock.current' });
  });

  it('returns a null clock when the caller is not clocked in', async () => {
    const { fake, reply } = makeReply<Rep>();
    await current(makeReq<FastifyRequest>({ actor: makeActor('manager') }), reply);
    expect(fake.sent).toMatchObject({ data: { clock: null }, event: 'clock.current' });
  });

  it('requires authentication', async () => {
    const { reply } = makeReply<Rep>();
    const error = await caught(current(makeReq<FastifyRequest>({ actor: null }), reply));
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.current.mockImplementationOnce(() => Promise.reject(failure));
    const { reply } = makeReply<Rep>();
    const error = await caught(
      current(makeReq<FastifyRequest>({ actor: makeActor('employee') }), reply),
    );
    expect(error.code).toBe('CLOCK_CURRENT_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.controller.current');
  });
});
