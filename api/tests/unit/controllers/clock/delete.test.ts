import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, ADMIN_ID, caught, EMPLOYEE_ID, MANAGER_ID, MISSING_ID, OTHER_ID } from '../../services/clock/support.js';
import { installClockService, installMembership } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { DeleteBody, DeleteResponse } from '@/controllers/clock/index.js';
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

const { remove } = await import('@/controllers/clock/delete.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>;
type Req = FastifyRequest<{ Body: DeleteBody }>;

const A = '00000000-0000-4000-8000-0000000000f1';
const B = '00000000-0000-4000-8000-0000000000f2';
const C = '00000000-0000-4000-8000-0000000000f3';

const run = async (actor: Actor | undefined, body: DeleteBody) => {
  const reply: FakeReply = Fake.reply();
  await remove(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const seed = (): void => {
  directory.set(A, sample(EMPLOYEE_ID, { id: A }));
  directory.set(B, sample(OTHER_ID, { id: B }));
  directory.set(C, sample(MANAGER_ID, { id: C }));
};

describe('clock.controller.delete', () => {
  it('dedupes ids and reports every processed id', async () => {
    seed();
    const reply = await run(actorOf('admin'), { ids: [A, A, B] });
    expect(svc.delete).toHaveBeenCalledTimes(2);
    expect(reply.payload).toMatchObject({
      data: { failed: [], success: true },
      event: { code: 'clock.deleted', payload: { actor: ADMIN_ID, deleted: 2, failed: 0 } },
    });
    const data = (reply.payload as ReplyEnvelope<DeleteResponse>).data;
    expect([...data.deleted].sort()).toEqual([A, B].sort());
  });

  it('lets a manager process clocks of managed users only, reporting the rest as not found', async () => {
    seed();
    managed.add(OTHER_ID);
    const reply = await run(actorOf('manager'), { ids: [A, B] });
    expect(svc.delete).toHaveBeenCalledTimes(1);
    expect(reply.payload).toMatchObject({
      data: { deleted: [B], failed: [{ code: 'clock.not.found', id: A }], success: false },
    });
  });

  it('never mutates anything when one clock is visible but not allowed', async () => {
    seed();
    const error = await caught(run(actorOf('manager'), { ids: [B, C] }));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('forbids employees', async () => {
    seed();
    const error = await caught(run(actorOf('employee'), { ids: [A] }));
    expect(error.code).toBe('unauthorized');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('reports unknown ids and service failures without aborting the rest', async () => {
    seed();
    const { ClockOverlapError } = await import('@/lib/errors/domains/clock.js');
    svc.delete.mockImplementationOnce(() => Promise.reject(ClockOverlapError()));
    const reply = await run(actorOf('admin'), { ids: [MISSING_ID, A, B] });
    const data = (reply.payload as ReplyEnvelope<DeleteResponse>).data;
    expect(data.success).toBe(false);
    expect(data.deleted).toHaveLength(1);
    expect(data.failed.map((item) => item.code).sort()).toEqual(['clock.not.found', 'clock.overlap']);
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(actorOf('admin'), { ids }));
    expect(error.code).toBe('validation.error');
    expect(error.status).toBe(400);
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(run(undefined, { ids: [A] }));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('reports an unexpected load failure as internal.unexpected without aborting', async () => {
    seed();
    const failure = new Error('boom');
    svc.retrieve.mockImplementationOnce(() => Promise.reject(failure));
    const reply = await run(actorOf('admin'), { ids: [A] });
    expect((reply.payload as ReplyEnvelope<DeleteResponse>).data.failed).toEqual([
      { code: 'internal.unexpected', id: A },
    ]);
  });
});
