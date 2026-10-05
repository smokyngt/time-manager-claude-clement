import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, caught, MANAGER_ID, OTHER_MANAGER_ID } from '../../services/team/support.js';
import { installTeamService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { CreateTeamBody, TeamResponse } from '@/controllers/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installTeamService();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

const { create } = await import('@/controllers/team/create.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>;
type Req = FastifyRequest<{ Body: CreateTeamBody }>;

const run = async (actor: Actor | undefined, body: CreateTeamBody) => {
  const reply: FakeReply = Fake.reply();
  await create(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const lastData = (): Record<string, unknown> =>
  (svc.create.mock.calls as unknown as [{ data: Record<string, unknown> }][])[0]?.[0].data ?? {};

describe('team.controller.create', () => {
  it('lets an admin choose the manager and replies with the event envelope', async () => {
    const reply = await run(actorOf('admin'), { manager_id: OTHER_MANAGER_ID, name: 'Support' });
    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toMatchObject({
      data: { team: { object: 'team' } },
      event: { code: 'team.created', correlation_id: 'req-test', payload: { actor: actorOf('admin').id } },
    });
    expect(lastData()['manager_id']).toBe(OTHER_MANAGER_ID);
  });

  it('makes an admin the manager when none is given', async () => {
    await run(actorOf('admin'), { name: 'Support' });
    expect(lastData()['manager_id']).toBe(actorOf('admin').id);
  });

  it('forces a manager to be the manager of the team', async () => {
    await run(actorOf('manager'), { manager_id: OTHER_MANAGER_ID, name: 'Support' });
    expect(lastData()['manager_id']).toBe(MANAGER_ID);
  });

  it('forbids employees and rejects anonymous callers', async () => {
    const employee = await caught(run(actorOf('employee'), { name: 'Support' }));
    const anonymous = await caught(run(undefined, { name: 'Support' }));
    expect(employee.code).toBe('unauthorized');
    expect(employee.status).toBe(403);
    expect(anonymous.code).toBe('token.authentication.failed');
    expect(anonymous.status).toBe(401);
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('keeps the invalid manager error raised by the service', async () => {
    const { TeamManagerInvalidError } = await import('@/lib/errors/domains/team.js');
    svc.create.mockImplementationOnce(() => Promise.reject(TeamManagerInvalidError()));
    const error = await caught(run(actorOf('admin'), { manager_id: MANAGER_ID, name: 'Support' }));
    expect(error.code).toBe('team.manager.invalid');
    expect(error.status).toBe(400);
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.create.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin'), { name: 'Support' }));
    expect(error.code).toBe('team.create.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.create');
  });
});
