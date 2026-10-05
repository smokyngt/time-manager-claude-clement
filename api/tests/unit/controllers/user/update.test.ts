import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import {
  actorOf,
  ADMIN_ID,
  caught,
  EMPLOYEE_ID,
  MANAGER_ID,
  MISSING_ID,
  OTHER_ID,
  userOf,
} from '../../services/user/support.js';
import { installMembership, installUserService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { UpdateUsersBody, UpdateUsersResponse } from '@/controllers/user/index.js';
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

const { update } = await import('@/controllers/user/update.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<UpdateUsersResponse> }>;
type Req = FastifyRequest<{ Body: UpdateUsersBody }>;

const run = async (actor: Actor | undefined, body: UpdateUsersBody) => {
  const reply: FakeReply = Fake.reply();
  await update(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const seed = (): void => {
  directory.set(EMPLOYEE_ID, userOf('employee', EMPLOYEE_ID));
  directory.set(OTHER_ID, userOf('employee', OTHER_ID));
  directory.set(MANAGER_ID, userOf('manager', MANAGER_ID));
  directory.set(ADMIN_ID, userOf('admin', ADMIN_ID));
};

describe('user.controller.update', () => {
  it('dedupes ids and reports every updated id', async () => {
    seed();
    const reply = await run(actorOf('admin'), {
      data: { first_name: 'Zed' },
      ids: [OTHER_ID, OTHER_ID, EMPLOYEE_ID],
    });
    expect(svc.update).toHaveBeenCalledTimes(2);
    expect(reply.payload).toMatchObject({
      data: { failed: [], success: true },
      event: {
        code: 'user.updated',
        payload: { actor: actorOf('admin').id, failed: 0, updated: 2 },
      },
    });
    const data = (reply.payload as ReplyEnvelope<UpdateUsersResponse>).data;
    expect([...data.updated].sort()).toEqual([EMPLOYEE_ID, OTHER_ID].sort());
  });

  it('lets an employee update only their own limited fields', async () => {
    seed();
    const reply = await run(actorOf('employee'), { data: { phone_number: null }, ids: [EMPLOYEE_ID] });
    expect(reply.payload).toMatchObject({ data: { success: true, updated: [EMPLOYEE_ID] } });
  });

  it('forbids an employee from changing their role or email', async () => {
    seed();
    const role = await caught(
      run(actorOf('employee'), { data: { role: 'admin' }, ids: [EMPLOYEE_ID] }),
    );
    const email = await caught(
      run(actorOf('employee'), { data: { email: 'x@y.co' }, ids: [EMPLOYEE_ID] }),
    );
    expect(role.code).toBe('unauthorized');
    expect(role.status).toBe(403);
    expect(email.code).toBe('unauthorized');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('forbids an employee from updating someone else without loading them', async () => {
    seed();
    const error = await caught(
      run(actorOf('employee'), { data: { first_name: 'X' }, ids: [OTHER_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(svc.retrieve).not.toHaveBeenCalled();
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('reports an admin as not found to a manager and updates the rest', async () => {
    seed();
    const reply = await run(actorOf('manager'), {
      data: { first_name: 'X' },
      ids: [OTHER_ID, ADMIN_ID],
    });
    expect(svc.update).toHaveBeenCalledTimes(1);
    expect(reply.payload).toMatchObject({
      data: { failed: [{ code: 'user.not.found', id: ADMIN_ID }], updated: [OTHER_ID] },
    });
  });

  it('forbids a manager from promoting an employee', async () => {
    seed();
    const error = await caught(
      run(actorOf('manager'), { data: { role: 'manager' }, ids: [OTHER_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('forbids an admin from changing their own role', async () => {
    seed();
    const error = await caught(
      run(actorOf('admin'), { data: { role: 'employee' }, ids: [ADMIN_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('never updates anything when one item has a forbidden field', async () => {
    seed();
    const error = await caught(
      run(actorOf('manager'), { data: { email: 'x@y.co' }, ids: [OTHER_ID, MANAGER_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('reports unknown ids and service failures without aborting the rest', async () => {
    seed();
    const { DuplicateKeyError } = await import('@/lib/errors/base/core.js');
    svc.update.mockImplementationOnce(() => Promise.reject(DuplicateKeyError()));
    const reply = await run(actorOf('admin'), {
      data: { first_name: 'X' },
      ids: [MISSING_ID, OTHER_ID, EMPLOYEE_ID],
    });
    const data = (reply.payload as ReplyEnvelope<UpdateUsersResponse>).data;
    expect(data.success).toBe(false);
    expect(data.updated).toHaveLength(1);
    expect(data.failed.map((item) => item.code).sort()).toEqual([
      'duplicate.key',
      'user.not.found',
    ]);
    expect(reply.payload).toMatchObject({ event: { code: 'user.updated' } });
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(actorOf('admin'), { data: { first_name: 'X' }, ids }));
    expect(error.code).toBe('validation.error');
    expect(error.status).toBe(400);
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const error = await caught(run(undefined, { data: { first_name: 'X' }, ids: [OTHER_ID] }));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('reports an employee of another manager team as not found', async () => {
    seed();
    teamed.add(OTHER_ID);
    const reply = await run(actorOf('manager'), { data: { first_name: 'X' }, ids: [OTHER_ID] });
    expect(reply.payload).toMatchObject({
      data: { failed: [{ code: 'user.not.found', id: OTHER_ID }] },
    });
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('lets a manager update an unassigned employee and an own team member', async () => {
    seed();
    teamed.add(EMPLOYEE_ID);
    managed.add(EMPLOYEE_ID);
    const reply = await run(actorOf('manager'), {
      data: { first_name: 'X' },
      ids: [OTHER_ID, EMPLOYEE_ID],
    });
    expect(reply.payload).toMatchObject({ data: { success: true } });
  });

  it('lets an employee send current_password when changing their own password', async () => {
    seed();
    const reply = await run(actorOf('employee'), {
      data: { current_password: 'old-long-password', password: 'new-long-password' },
      ids: [EMPLOYEE_ID],
    });
    expect(reply.payload).toMatchObject({ data: { success: true } });
  });

  it('forbids a manager from sending current_password for another user', async () => {
    seed();
    const error = await caught(
      run(actorOf('manager'), {
        data: { current_password: 'old-long-password', password: 'new-long-password' },
        ids: [OTHER_ID],
      }),
    );
    expect(error.code).toBe('unauthorized');
  });
});
