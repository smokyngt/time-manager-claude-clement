import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, caught } from '../../services/user/support.js';
import { installUserService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { CreateUserBody, UserResponse } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installUserService();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

const { create } = await import('@/controllers/user/create.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>;
type Req = FastifyRequest<{ Body: CreateUserBody }>;

const run = async (actor: Actor | undefined, body: CreateUserBody) => {
  const reply: FakeReply = Fake.reply();
  await create(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const body: CreateUserBody = { email: 'new@example.com', first_name: 'New', last_name: 'Hire' };

describe('user.controller.create', () => {
  it('lets an admin create a manager and replies with the event envelope', async () => {
    const reply = await run(actorOf('admin'), { ...body, role: 'manager' });
    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toMatchObject({
      data: { user: { object: 'user', role: 'manager' } },
      event: {
        code: 'user.created',
        correlation_id: 'req-test',
        payload: { actor: actorOf('admin').id },
      },
    });
    expect(svc.create).toHaveBeenCalledTimes(1);
  });

  it('lets a manager create an employee', async () => {
    const reply = await run(actorOf('manager'), body);
    expect(reply.payload).toMatchObject({ event: { code: 'user.created' } });
  });

  it('forbids a manager from creating a manager or an admin before calling the service', async () => {
    const asManager = await caught(run(actorOf('manager'), { ...body, role: 'manager' }));
    const asAdmin = await caught(run(actorOf('manager'), { ...body, role: 'admin' }));
    expect(asManager.code).toBe('unauthorized');
    expect(asManager.status).toBe(403);
    expect(asAdmin.code).toBe('unauthorized');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('forbids employees and rejects anonymous callers', async () => {
    const employee = await caught(run(actorOf('employee'), body));
    const anonymous = await caught(run(undefined, body));
    expect(employee.code).toBe('unauthorized');
    expect(anonymous.code).toBe('token.authentication.failed');
    expect(anonymous.status).toBe(401);
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('keeps the duplicate key error raised by the service', async () => {
    const { DuplicateKeyError } = await import('@/lib/errors/base/core.js');
    svc.create.mockImplementationOnce(() => Promise.reject(DuplicateKeyError()));
    const error = await caught(run(actorOf('admin'), body));
    expect(error.code).toBe('duplicate.key');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.create.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin'), body));
    expect(error.code).toBe('user.create.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.controller.create');
  });
});
