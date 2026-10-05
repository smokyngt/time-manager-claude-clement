import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  caught,
  EMPLOYEE_ID,
  makeActor,
  makeReply,
  makeReq,
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

import type { UpdateBody, UpdateResponse } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { update } = await import('@/controllers/clock/update.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>;
type Req = FastifyRequest<{ Body: UpdateBody }>;

const OWN = '00000000-0000-4000-8000-0000000000e1';
const MANAGED = '00000000-0000-4000-8000-0000000000e2';
const FOREIGN = '00000000-0000-4000-8000-0000000000e3';

const run = async (actor: Actor | null, body: UpdateBody) => {
  const { fake, reply } = makeReply<Rep>();
  await update(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const seed = (): void => {
  directory.set(OWN, makeClock(OWN, EMPLOYEE_ID));
  directory.set(MANAGED, makeClock(MANAGED, OTHER_ID));
  directory.set(FOREIGN, makeClock(FOREIGN, '00000000-0000-4000-8000-0000000000c9'));
  managed.add(OTHER_ID);
};

describe('clock.controller.update', () => {
  it('dedupes ids and reports every updated id', async () => {
    seed();
    const fake = await run(makeActor('admin'), {
      data: { note: 'fixed' },
      ids: [OWN, OWN, FOREIGN],
    });
    expect(svc.update).toHaveBeenCalledTimes(2);
    expect(fake.sent).toMatchObject({
      data: { failed: [], success: true },
      event: 'clock.updated',
    });
    const data = (fake.sent as { data: UpdateResponse }).data;
    expect([...data.updated].sort()).toEqual([OWN, FOREIGN].sort());
  });

  it('lets a manager correct the clocks of managed users', async () => {
    seed();
    const fake = await run(makeActor('manager'), { data: { note: 'x' }, ids: [MANAGED] });
    expect(fake.sent).toMatchObject({ data: { success: true, updated: [MANAGED] } });
  });

  it('checks every item before any write: one forbidden item blocks the whole request', async () => {
    seed();
    const error = await caught(
      run(makeActor('manager'), { data: { note: 'x' }, ids: [MANAGED, FOREIGN] }),
    );
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('forbids employees without loading anything', async () => {
    seed();
    const error = await caught(run(makeActor('employee'), { data: { note: 'x' }, ids: [OWN] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.retrieve).not.toHaveBeenCalled();
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('reports unknown ids and service failures in failed without aborting the rest', async () => {
    seed();
    const { ClockOverlapError } = await import('@/lib/errors/domains/clock.js');
    svc.update.mockImplementationOnce(() => Promise.reject(ClockOverlapError()));
    const fake = await run(makeActor('admin'), {
      data: { clocked_in_at: 1 },
      ids: [MISSING_ID, OWN, MANAGED],
    });
    const data = (fake.sent as { data: UpdateResponse }).data;
    expect(data.success).toBe(false);
    expect(data.updated).toHaveLength(1);
    expect(data.failed.map((item) => item.code).sort()).toEqual([
      'CLOCK_NOT_FOUND',
      'CLOCK_OVERLAP',
    ]);
    expect(fake.sent).toMatchObject({ event: 'clock.updated' });
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(makeActor('admin'), { data: { note: 'x' }, ids }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, { data: { note: 'x' }, ids: [OWN] }));
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
