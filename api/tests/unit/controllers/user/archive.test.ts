import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  ADMIN_ID,
  caught,
  makeActor,
  makeReply,
  makeReq,
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

import type { ArchiveParams } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { archive } = await import('@/controllers/user/archive.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<User> }>;
type Req = FastifyRequest<{ Params: ArchiveParams }>;

const run = async (actor: Actor | null, id: string) => {
  const { fake, reply } = makeReply<Rep>();
  await archive(makeReq<Req>({ actor, params: { id } }), reply);
  return fake;
};

describe('user.controller.archive', () => {
  it('lets a manager archive an employee', async () => {
    directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
    const fake = await run(makeActor('manager'), OTHER_ID);
    expect(fake.sent).toMatchObject({ data: { id: OTHER_ID }, event: 'user.archived' });
    expect(svc.archive).toHaveBeenCalledTimes(1);
  });

  it('forbids a manager from touching an admin', async () => {
    directory.set(ADMIN_ID, makeUser('admin', ADMIN_ID));
    const error = await caught(run(makeActor('manager'), ADMIN_ID));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(svc.archive).not.toHaveBeenCalled();
  });

  it('forbids employees without loading the target', async () => {
    const error = await caught(run(makeActor('employee'), OTHER_ID));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('applies the self-protection rule', async () => {
    directory.set(ADMIN_ID, makeUser('admin', ADMIN_ID));
    const outcome = await run(makeActor('admin'), ADMIN_ID).then(
      () => 'ok',
      (error: unknown) => (error as { code: string }).code,
    );
    expect(outcome).toBe('FORBIDDEN');
  });

  it('keeps the 404 raised by the service', async () => {
    const error = await caught(run(makeActor('admin'), MISSING_ID));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('forbids a manager from an employee of another manager team', async () => {
    directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
    teamed.add(OTHER_ID);
    const error = await caught(run(makeActor('manager'), OTHER_ID));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(svc.archive).not.toHaveBeenCalled();
  });

  it('lets a manager act on a member of a team they manage', async () => {
    directory.set(OTHER_ID, makeUser('employee', OTHER_ID));
    teamed.add(OTHER_ID);
    managed.add(OTHER_ID);
    const fake = await run(makeActor('manager'), OTHER_ID);
    expect(fake.sent).toMatchObject({ data: { id: OTHER_ID } });
  });
});
