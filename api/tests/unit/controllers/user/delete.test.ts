import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  ADMIN_ID,
  caught,
  makeActor,
  makeReply,
  makeReq,
  MANAGER_ID,
  MISSING_ID,
  OTHER_ID,
} from '../../../helpers/fixtures.js';
import { installMembership } from '../../../helpers/membership.js';
import { installUserService, makeUser } from '../../../helpers/user-service.js';

const harness = await installUserService();
const membership = await installMembership();
const { managed, teamed } = membership;
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
  membership.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
  managed.clear();
  teamed.clear();
});

import type { DeleteBody, DeleteResponse } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { remove } = await import('@/controllers/user/delete.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>;
type Req = FastifyRequest<{ Body: DeleteBody }>;

const run = async (actor: Actor | null, body: DeleteBody) => {
  const { fake, reply } = makeReply<Rep>();
  await remove(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const seed = (): void => {
  directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
  directory.set(MANAGER_ID, makeUser('manager', MANAGER_ID));
  directory.set(ADMIN_ID, makeUser('admin', ADMIN_ID));
};

describe('user.controller.delete', () => {
  it('lets a manager delete employees and dedupes ids', async () => {
    seed();
    const fake = await run(makeActor('manager'), { ids: [OTHER_ID, OTHER_ID] });
    expect(svc.delete).toHaveBeenCalledTimes(1);
    expect(fake.sent).toMatchObject({
      data: { deleted: [OTHER_ID], failed: [], success: true },
      event: 'user.deleted',
    });
  });

  it('lets an admin delete a manager', async () => {
    seed();
    const fake = await run(makeActor('admin'), { ids: [MANAGER_ID] });
    expect(fake.sent).toMatchObject({ data: { deleted: [MANAGER_ID] } });
  });

  it('forbids deleting yourself, even for an admin', async () => {
    seed();
    const error = await caught(run(makeActor('admin'), { ids: [ADMIN_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('reports an admin as not found to a manager and deletes the rest', async () => {
    seed();
    const fake = await run(makeActor('manager'), { ids: [OTHER_ID, ADMIN_ID] });
    expect(svc.delete).toHaveBeenCalledTimes(1);
    expect(fake.sent).toMatchObject({
      data: { deleted: [OTHER_ID], failed: [{ code: 'USER_NOT_FOUND', id: ADMIN_ID }] },
    });
  });

  it('forbids employees before loading anything', async () => {
    seed();
    const error = await caught(run(makeActor('employee'), { ids: [OTHER_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('reports unknown ids in failed', async () => {
    seed();
    const fake = await run(makeActor('admin'), { ids: [MISSING_ID, OTHER_ID] });
    expect(fake.sent).toMatchObject({
      data: {
        deleted: [OTHER_ID],
        failed: [{ code: 'USER_NOT_FOUND', id: MISSING_ID }],
        success: false,
      },
    });
  });

  it('reports service failures in failed', async () => {
    seed();
    svc.delete.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const fake = await run(makeActor('admin'), { ids: [OTHER_ID] });
    expect(fake.sent).toMatchObject({
      data: { deleted: [], failed: [{ code: 'INTERNAL_ERROR', id: OTHER_ID }], success: false },
    });
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(makeActor('admin'), { ids }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('reports as not found to a manager an employee of another manager team', async () => {
    seed();
    teamed.add(OTHER_ID);
    const fake = await run(makeActor('manager'), { ids: [OTHER_ID] });
    expect(fake.sent).toMatchObject({
      data: { failed: [{ code: 'USER_NOT_FOUND', id: OTHER_ID }] },
    });
    expect(svc.delete).not.toHaveBeenCalled();
  });
});
