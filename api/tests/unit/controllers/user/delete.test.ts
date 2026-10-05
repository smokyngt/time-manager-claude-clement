import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import {
  actorOf,
  ADMIN_ID,
  caught,
  MANAGER_ID,
  MISSING_ID,
  OTHER_ID,
  userOf,
} from '../../services/user/support.js';
import { installMembership, installUserService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { DeleteUsersBody, DeleteUsersResponse } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

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

const { remove } = await import('@/controllers/user/delete.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<DeleteUsersResponse> }>;
type Req = FastifyRequest<{ Body: DeleteUsersBody }>;

const run = async (actor: Actor | undefined, body: DeleteUsersBody) => {
  const reply: FakeReply = Fake.reply();
  await remove(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const seed = (): void => {
  directory.set(OTHER_ID, userOf('employee', OTHER_ID));
  directory.set(MANAGER_ID, userOf('manager', MANAGER_ID));
  directory.set(ADMIN_ID, userOf('admin', ADMIN_ID));
};

describe('user.controller.delete', () => {
  it('lets a manager delete employees and dedupes ids', async () => {
    seed();
    const reply = await run(actorOf('manager'), { ids: [OTHER_ID, OTHER_ID] });
    expect(svc.delete).toHaveBeenCalledTimes(1);
    expect(reply.payload).toMatchObject({
      data: { deleted: [OTHER_ID], failed: [], success: true },
      event: {
        code: 'user.deleted',
        payload: { actor: actorOf('manager').id, deleted: 1, failed: 0 },
      },
    });
  });

  it('lets an admin delete a manager', async () => {
    seed();
    const reply = await run(actorOf('admin'), { ids: [MANAGER_ID] });
    expect(reply.payload).toMatchObject({ data: { deleted: [MANAGER_ID] } });
  });

  it('forbids deleting yourself, even for an admin', async () => {
    seed();
    const error = await caught(run(actorOf('admin'), { ids: [ADMIN_ID] }));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('reports an admin as not found to a manager and deletes the rest', async () => {
    seed();
    const reply = await run(actorOf('manager'), { ids: [OTHER_ID, ADMIN_ID] });
    expect(svc.delete).toHaveBeenCalledTimes(1);
    expect(reply.payload).toMatchObject({
      data: { deleted: [OTHER_ID], failed: [{ code: 'user.not.found', id: ADMIN_ID }] },
    });
  });

  it('forbids employees before loading anything', async () => {
    seed();
    const error = await caught(run(actorOf('employee'), { ids: [OTHER_ID] }));
    expect(error.code).toBe('unauthorized');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('never deletes anything when one item is forbidden', async () => {
    seed();
    const error = await caught(run(actorOf('manager'), { ids: [OTHER_ID, MANAGER_ID] }));
    expect(error.code).toBe('unauthorized');
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('reports unknown ids in failed', async () => {
    seed();
    const reply = await run(actorOf('admin'), { ids: [MISSING_ID, OTHER_ID] });
    expect(reply.payload).toMatchObject({
      data: {
        deleted: [OTHER_ID],
        failed: [{ code: 'user.not.found', id: MISSING_ID }],
        success: false,
      },
    });
  });

  it('reports service failures in failed', async () => {
    seed();
    svc.delete.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const reply = await run(actorOf('admin'), { ids: [OTHER_ID] });
    expect(reply.payload).toMatchObject({
      data: { deleted: [], failed: [{ code: 'internal.unexpected', id: OTHER_ID }], success: false },
    });
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

  it('rejects anonymous callers', async () => {
    const error = await caught(run(undefined, { ids: [OTHER_ID] }));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('reports an employee of another manager team as not found', async () => {
    seed();
    teamed.add(OTHER_ID);
    const reply = await run(actorOf('manager'), { ids: [OTHER_ID] });
    expect(reply.payload).toMatchObject({
      data: { failed: [{ code: 'user.not.found', id: OTHER_ID }] },
    });
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures with the controller route', async () => {
    seed();
    const failure = new Error('boom');
    svc.retrieve.mockImplementationOnce(() => {
      throw failure;
    });
    const error = await caught(run(actorOf('admin'), { ids: [OTHER_ID] }));
    expect(error.code).toBe('user.delete.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.controller.delete');
  });
});
