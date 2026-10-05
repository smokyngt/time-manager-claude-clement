import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, ADMIN_ID, caught, MISSING_ID, OTHER_ID, userOf } from '../../services/user/support.js';

import { installMembership, installUserService } from './support.js';

import type { ArchiveParams, UserResponse } from '@/controllers/user/index.js';
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

const { archive } = await import('@/controllers/user/archive.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>;
type Req = FastifyRequest<{ Params: ArchiveParams }>;

const run = async (actor: Actor | undefined, id: string) => {
  const reply = Fake.reply<Rep>();
  await archive(Fake.request({ actor, params: { id } }) as Req, reply);

  return reply;
};

describe('user.controller.archive', () => {
  it('lets a manager archive an employee and replies with the named user', async () => {
    directory.set(OTHER_ID, userOf('employee', OTHER_ID));
    const reply = await run(actorOf('manager'), OTHER_ID);
    expect(reply.payload).toMatchObject({
      data: { user: { id: OTHER_ID } },
      event: {
        code: 'user.archived',
        correlation_id: 'req-test',
        payload: { actor: actorOf('manager').id, user_id: OTHER_ID },
      },
    });
    expect(svc.archive).toHaveBeenCalledTimes(1);
  });

  it('reports an admin as not found to a manager', async () => {
    directory.set(ADMIN_ID, userOf('admin', ADMIN_ID));
    const error = await caught(run(actorOf('manager'), ADMIN_ID));
    expect(error.code).toBe('user.not.found');
    expect(error.status).toBe(404);
    expect(svc.archive).not.toHaveBeenCalled();
  });

  it('forbids employees without loading the target', async () => {
    const error = await caught(run(actorOf('employee'), OTHER_ID));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('applies the self-protection rule', async () => {
    directory.set(ADMIN_ID, userOf('admin', ADMIN_ID));
    const error = await caught(run(actorOf('admin'), ADMIN_ID));
    expect(error.code).toBe('unauthorized');
    expect(svc.archive).not.toHaveBeenCalled();
  });

  it('keeps the 404 raised by the service', async () => {
    const error = await caught(run(actorOf('admin'), MISSING_ID));
    expect(error.code).toBe('user.not.found');
    expect(error.status).toBe(404);
  });

  it('reports an employee of another manager team as not found', async () => {
    directory.set(OTHER_ID, userOf('employee', OTHER_ID));
    teamed.add(OTHER_ID);
    const error = await caught(run(actorOf('manager'), OTHER_ID));
    expect(error.code).toBe('user.not.found');
    expect(svc.archive).not.toHaveBeenCalled();
  });

  it('lets a manager act on a member of a team they manage', async () => {
    directory.set(OTHER_ID, userOf('employee', OTHER_ID));
    teamed.add(OTHER_ID);
    managed.add(OTHER_ID);
    const reply = await run(actorOf('manager'), OTHER_ID);
    expect(reply.payload).toMatchObject({ data: { user: { id: OTHER_ID } } });
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(run(undefined, OTHER_ID));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    directory.set(OTHER_ID, userOf('employee', OTHER_ID));
    const failure = new Error('boom');
    svc.archive.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin'), OTHER_ID));
    expect(error.code).toBe('user.archive.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.controller.archive');
  });
});
