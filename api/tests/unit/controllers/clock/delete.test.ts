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

import type { DeleteBody, DeleteResponse } from '@/controllers/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { remove } = await import('@/controllers/clock/delete.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>;
type Req = FastifyRequest<{ Body: DeleteBody }>;

const OWN = '00000000-0000-4000-8000-0000000000e1';
const MANAGED = '00000000-0000-4000-8000-0000000000e2';
const FOREIGN = '00000000-0000-4000-8000-0000000000e3';

const run = async (actor: Actor | null, body: DeleteBody) => {
  const { fake, reply } = makeReply<Rep>();
  await remove(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const seed = (): void => {
  directory.set(OWN, makeClock(OWN, EMPLOYEE_ID));
  directory.set(MANAGED, makeClock(MANAGED, OTHER_ID));
  directory.set(FOREIGN, makeClock(FOREIGN, '00000000-0000-4000-8000-0000000000c9'));
  managed.add(OTHER_ID);
};

describe('clock.controller.delete', () => {
  it('dedupes ids and reports every deleted id', async () => {
    seed();
    const fake = await run(makeActor('admin'), { ids: [OWN, OWN, FOREIGN] });
    expect(svc.delete).toHaveBeenCalledTimes(2);
    expect(fake.sent).toMatchObject({
      data: { failed: [], success: true },
      event: 'clock.deleted',
    });
    const data = (fake.sent as { data: DeleteResponse }).data;
    expect([...data.deleted].sort()).toEqual([OWN, FOREIGN].sort());
  });

  it('lets a manager delete the clocks of managed users', async () => {
    seed();
    const fake = await run(makeActor('manager'), { ids: [MANAGED] });
    expect(fake.sent).toMatchObject({ data: { deleted: [MANAGED], success: true } });
  });

  it('checks every item before any deletion', async () => {
    seed();
    const error = await caught(run(makeActor('manager'), { ids: [MANAGED, FOREIGN] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('forbids employees without loading anything', async () => {
    seed();
    const error = await caught(run(makeActor('employee'), { ids: [OWN] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.retrieve).not.toHaveBeenCalled();
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('reports unknown ids and service failures in failed without aborting the rest', async () => {
    seed();
    svc.delete.mockImplementationOnce(() => Promise.reject(new Error('db down')));
    const fake = await run(makeActor('admin'), { ids: [MISSING_ID, OWN, MANAGED] });
    const data = (fake.sent as { data: DeleteResponse }).data;
    expect(data.success).toBe(false);
    expect(data.deleted).toHaveLength(1);
    expect(data.failed.map((item) => item.code).sort()).toEqual([
      'CLOCK_NOT_FOUND',
      'INTERNAL_ERROR',
    ]);
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(makeActor('admin'), { ids }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, { ids: [OWN] }));
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
