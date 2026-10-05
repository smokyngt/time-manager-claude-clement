import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  caught,
  makeActor,
  makeReply,
  makeReq,
  MANAGER_ID,
  OTHER_ID,
} from '../../../helpers/fixtures.js';
import { installTeamService } from '../../services/team/fixtures.js';
import { installMembership } from './common.js';

const harness = await installTeamService();
const membership = await installMembership();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
  membership.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

import type { CreateBody } from '@/controllers/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { create } = await import('@/controllers/team/create.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<Team> }>;
type Req = FastifyRequest<{ Body: CreateBody }>;

const run = async (actor: Actor | null, body: CreateBody) => {
  const { fake, reply } = makeReply<Rep>();
  await create(makeReq<Req>({ actor, body }), reply);
  return fake;
};

describe('team.controller.create', () => {
  it('lets an admin pick the manager', async () => {
    const fake = await run(makeActor('admin'), { manager_id: OTHER_ID, name: 'A' });
    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { manager_id: OTHER_ID, name: 'A' } }),
    );
    expect(fake.sent).toMatchObject({ event: 'team.created' });
  });

  it('defaults the manager of an admin to themselves', async () => {
    const admin = makeActor('admin');
    await run(admin, { name: 'A' });
    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { manager_id: admin.id, name: 'A' } }),
    );
  });

  it('forces the manager of a manager to themselves', async () => {
    await run(makeActor('manager'), { manager_id: OTHER_ID, name: 'A' });
    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { manager_id: MANAGER_ID, name: 'A' } }),
    );
  });

  it('forbids an employee', async () => {
    const error = await caught(run(makeActor('employee'), { name: 'A' }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('wraps service failures and keeps the cause', async () => {
    const failure = new Error('db down');
    svc.create.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('admin'), { name: 'A' }));
    expect(error.code).toBe('TEAM_CREATE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.create');
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, { name: 'A' }));
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
