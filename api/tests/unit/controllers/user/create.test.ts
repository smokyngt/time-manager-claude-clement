import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq } from '../../../helpers/fixtures.js';
import { installUserService } from '../../../helpers/user-service.js';

const harness = await installUserService();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

import type { CreateBody } from '@/controllers/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { create } = await import('@/controllers/user/create.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<User> }>;
type Req = FastifyRequest<{ Body: CreateBody }>;

const run = async (actor: Actor | null, body: CreateBody) => {
  const { fake, reply } = makeReply<Rep>();
  await create(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const body: CreateBody = { email: 'new@example.com', first_name: 'New', last_name: 'Hire' };

describe('user.controller.create', () => {
  it('lets an admin create a manager and replies with the event envelope', async () => {
    const fake = await run(makeActor('admin'), { ...body, role: 'manager' });
    expect(fake.statusCode).toBe(200);
    expect(fake.sent).toMatchObject({
      data: { object: 'user', role: 'manager' },
      event: 'user.created',
    });
    expect(svc.create).toHaveBeenCalledTimes(1);
  });

  it('lets a manager create an employee', async () => {
    const fake = await run(makeActor('manager'), body);
    expect(fake.sent).toMatchObject({ event: 'user.created' });
  });

  it('forbids a manager from creating a manager or an admin before calling the service', async () => {
    const asManager = await caught(run(makeActor('manager'), { ...body, role: 'manager' }));
    const asAdmin = await caught(run(makeActor('manager'), { ...body, role: 'admin' }));
    expect(asManager.code).toBe('FORBIDDEN');
    expect(asManager.status).toBe(403);
    expect(asAdmin.code).toBe('FORBIDDEN');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('forbids employees and anonymous callers', async () => {
    const employee = await caught(run(makeActor('employee'), body));
    const anonymous = await caught(run(null, body));
    expect(employee.code).toBe('FORBIDDEN');
    expect(anonymous.code).toBe('UNAUTHORIZED');
    expect(anonymous.status).toBe(401);
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('keeps the domain error raised by the service', async () => {
    const { UserConflictError } = await import('@/lib/errors/domains/user.js');
    svc.create.mockImplementationOnce(() => Promise.reject(UserConflictError()));
    const error = await caught(run(makeActor('admin'), body));
    expect(error.code).toBe('USER_CONFLICT');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.create.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('admin'), body));
    expect(error.code).toBe('USER_CREATE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.controller.create');
  });
});
