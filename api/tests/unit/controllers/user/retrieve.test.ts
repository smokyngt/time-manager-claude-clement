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

import type { RetrieveParams } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { retrieve } = await import('@/controllers/user/retrieve.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<User> }>;
type Req = FastifyRequest<{ Params: RetrieveParams }>;

const run = async (actor: Actor | null, id: string) => {
  const { fake, reply } = makeReply<Rep>();
  await retrieve(makeReq<Req>({ actor, params: { id } }), reply);
  return fake;
};

describe('user.controller.retrieve', () => {
  it('lets an employee retrieve themselves', async () => {
    directory.set(EMPLOYEE_ID, makeUser('employee', EMPLOYEE_ID));
    const fake = await run(makeActor('employee'), EMPLOYEE_ID);
    expect(fake.sent).toMatchObject({ data: { id: EMPLOYEE_ID }, event: 'user.retrieved' });
  });

  it('forbids an employee from retrieving someone else without touching the service', async () => {
    directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
    const error = await caught(run(makeActor('employee'), OTHER_ID));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('lets a manager retrieve an employee but not an admin', async () => {
    directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
    directory.set(ADMIN_ID, makeUser('admin', ADMIN_ID));
    const ok = await run(makeActor('manager'), OTHER_ID);
    const error = await caught(run(makeActor('manager'), ADMIN_ID));
    expect(ok.sent).toMatchObject({ data: { id: OTHER_ID } });
    expect(error.code).toBe('FORBIDDEN');
  });

  it('lets an admin retrieve anyone', async () => {
    directory.set(MANAGER_ID, makeUser('manager', MANAGER_ID));
    const fake = await run(makeActor('admin'), MANAGER_ID);
    expect(fake.sent).toMatchObject({ data: { id: MANAGER_ID } });
  });

  it('keeps the 404 raised by the service', async () => {
    const error = await caught(run(makeActor('admin'), MISSING_ID));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('lets a manager read an unassigned employee and an own team member', async () => {
    directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
    directory.set(EMPLOYEE_ID, makeUser('employee', EMPLOYEE_ID));
    teamed.add(EMPLOYEE_ID);
    managed.add(EMPLOYEE_ID);
    const unassigned = await run(makeActor('manager'), OTHER_ID);
    const member = await run(makeActor('manager'), EMPLOYEE_ID);
    expect(unassigned.sent).toMatchObject({ data: { id: OTHER_ID } });
    expect(member.sent).toMatchObject({ data: { id: EMPLOYEE_ID } });
  });

  it('forbids a manager from reading an employee of another manager team', async () => {
    directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
    teamed.add(OTHER_ID);
    const error = await caught(run(makeActor('manager'), OTHER_ID));
    expect(error.code).toBe('FORBIDDEN');
  });
});
