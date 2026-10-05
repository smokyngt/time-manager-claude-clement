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

import type { UpdateBody, UpdateResponse } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { update } = await import('@/controllers/user/update.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>;
type Req = FastifyRequest<{ Body: UpdateBody }>;

const run = async (actor: Actor | null, body: UpdateBody) => {
  const { fake, reply } = makeReply<Rep>();
  await update(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const seed = (): void => {
  directory.set(EMPLOYEE_ID, makeUser('employee', EMPLOYEE_ID));
  directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
  directory.set(MANAGER_ID, makeUser('manager', MANAGER_ID));
  directory.set(ADMIN_ID, makeUser('admin', ADMIN_ID));
};

describe('user.controller.update', () => {
  it('dedupes ids and reports every updated id', async () => {
    seed();
    const fake = await run(makeActor('admin'), {
      data: { first_name: 'Zed' },
      ids: [OTHER_ID, OTHER_ID, EMPLOYEE_ID],
    });
    expect(svc.update).toHaveBeenCalledTimes(2);
    expect(fake.sent).toMatchObject({
      data: { failed: [], success: true },
      event: 'user.updated',
    });
    const data = (fake.sent as { data: UpdateResponse }).data;
    expect([...data.updated].sort()).toEqual([EMPLOYEE_ID, OTHER_ID].sort());
  });

  it('lets an employee update only their own limited fields', async () => {
    seed();
    const fake = await run(makeActor('employee'), {
      data: { phone_number: null },
      ids: [EMPLOYEE_ID],
    });
    expect(fake.sent).toMatchObject({ data: { success: true, updated: [EMPLOYEE_ID] } });
  });

  it('forbids an employee from changing their role or email', async () => {
    seed();
    const role = await caught(
      run(makeActor('employee'), { data: { role: 'admin' }, ids: [EMPLOYEE_ID] }),
    );
    const email = await caught(
      run(makeActor('employee'), { data: { email: 'x@y.co' }, ids: [EMPLOYEE_ID] }),
    );
    expect(role.code).toBe('FORBIDDEN');
    expect(email.code).toBe('FORBIDDEN');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('forbids an employee from updating someone else without loading them', async () => {
    seed();
    const error = await caught(
      run(makeActor('employee'), { data: { first_name: 'X' }, ids: [OTHER_ID] }),
    );
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.retrieve).not.toHaveBeenCalled();
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('reports an admin as not found to a manager and updates the rest', async () => {
    seed();
    const fake = await run(makeActor('manager'), {
      data: { first_name: 'X' },
      ids: [OTHER_ID, ADMIN_ID],
    });
    expect(svc.update).toHaveBeenCalledTimes(1);
    expect(fake.sent).toMatchObject({
      data: { failed: [{ code: 'USER_NOT_FOUND', id: ADMIN_ID }], updated: [OTHER_ID] },
    });
  });

  it('forbids a manager from promoting an employee', async () => {
    seed();
    const error = await caught(
      run(makeActor('manager'), { data: { role: 'manager' }, ids: [OTHER_ID] }),
    );
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('forbids an admin from changing their own role', async () => {
    seed();
    const error = await caught(
      run(makeActor('admin'), { data: { role: 'employee' }, ids: [ADMIN_ID] }),
    );
    expect(error.code).toBe('FORBIDDEN');
  });

  it('reports unknown ids and service failures in failed without aborting the rest', async () => {
    seed();
    const { UserConflictError } = await import('@/lib/errors/domains/user.js');
    svc.update.mockImplementationOnce(() => Promise.reject(UserConflictError()));
    const fake = await run(makeActor('admin'), {
      data: { first_name: 'X' },
      ids: [MISSING_ID, OTHER_ID, EMPLOYEE_ID],
    });
    const data = (fake.sent as { data: UpdateResponse }).data;
    expect(data.success).toBe(false);
    expect(data.updated).toHaveLength(1);
    expect(data.failed.map((item) => item.code).sort()).toEqual([
      'USER_CONFLICT',
      'USER_NOT_FOUND',
    ]);
    expect(fake.sent).toMatchObject({ event: 'user.updated' });
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(makeActor('admin'), { data: { first_name: 'X' }, ids }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, { data: { first_name: 'X' }, ids: [OTHER_ID] }));
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('reports as not found to a manager an employee of another manager team', async () => {
    seed();
    teamed.add(OTHER_ID);
    const fake = await run(makeActor('manager'), { data: { first_name: 'X' }, ids: [OTHER_ID] });
    expect(fake.sent).toMatchObject({
      data: { failed: [{ code: 'USER_NOT_FOUND', id: OTHER_ID }] },
    });
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('lets a manager update an unassigned employee and an own team member', async () => {
    seed();
    teamed.add(EMPLOYEE_ID);
    managed.add(EMPLOYEE_ID);
    const fake = await run(makeActor('manager'), {
      data: { first_name: 'X' },
      ids: [OTHER_ID, EMPLOYEE_ID],
    });
    expect(fake.sent).toMatchObject({ data: { success: true } });
  });

  it('lets an employee send current_password when changing their own password', async () => {
    seed();
    const fake = await run(makeActor('employee'), {
      data: { current_password: 'old-long-password', password: 'new-long-password' },
      ids: [EMPLOYEE_ID],
    });
    expect(fake.sent).toMatchObject({ data: { success: true } });
  });

  it('forbids a manager from sending current_password for another user', async () => {
    seed();
    const error = await caught(
      run(makeActor('manager'), {
        data: { current_password: 'old-long-password', password: 'new-long-password' },
        ids: [OTHER_ID],
      }),
    );
    expect(error.code).toBe('FORBIDDEN');
  });
});
