import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import {
  actorOf,
  ADMIN_ID,
  caught,
  MANAGER_ID,
  MISSING_ID,
  OTHER_MANAGER_ID,
  TEAM_ID,
  teamOf,
} from '../../services/team/support.js';
import { installMembers, installTeamService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { RestoreParams, TeamResponse } from '@/controllers/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installTeamService();
const members = await installMembers();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
  members.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
  members.fakeDb.reset();
});

const { restore } = await import('@/controllers/team/restore.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>;
type Req = FastifyRequest<{ Params: RestoreParams }>;

const run = async (actor: Actor | undefined, id: string) => {
  const reply: FakeReply = Fake.reply();
  await restore(Fake.request({ actor, params: { id } }) as Req, reply as unknown as Rep);

  return reply;
};

describe('team.controller.restore', () => {
  it('lets an admin restore any team and replies with the named team', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID, OTHER_MANAGER_ID));
    const reply = await run(actorOf('admin'), TEAM_ID);
    expect(svc.restore).toHaveBeenCalledTimes(1);
    expect(reply.payload).toMatchObject({
      data: { team: { id: TEAM_ID } },
      event: { code: 'team.restored', payload: { actor: ADMIN_ID, team_id: TEAM_ID } },
    });
  });

  it('lets a manager restore a team they manage', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID, MANAGER_ID));
    const reply = await run(actorOf('manager'), TEAM_ID);
    expect(reply.payload).toMatchObject({ event: { code: 'team.restored' } });
  });

  it('reports a team of another manager as not found to a manager', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID, OTHER_MANAGER_ID));
    const error = await caught(run(actorOf('manager'), TEAM_ID));
    expect(error.code).toBe('team.not.found');
    expect(error.status).toBe(404);
    expect(svc.restore).not.toHaveBeenCalled();
  });

  it('forbids a manager who is only a member', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID, OTHER_MANAGER_ID));
    members.member(true);
    const error = await caught(run(actorOf('manager'), TEAM_ID));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.restore).not.toHaveBeenCalled();
  });

  it('forbids an employee member', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID));
    members.member(true);
    const error = await caught(run(actorOf('employee'), TEAM_ID));
    expect(error.code).toBe('unauthorized');
    expect(svc.restore).not.toHaveBeenCalled();
  });

  it('reports a team an employee does not belong to as not found', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID));
    members.member(false);
    const error = await caught(run(actorOf('employee'), TEAM_ID));
    expect(error.code).toBe('team.not.found');
  });

  it('keeps the 404 raised by the service', async () => {
    const error = await caught(run(actorOf('admin'), MISSING_ID));
    expect(error.code).toBe('team.not.found');
    expect(error.status).toBe(404);
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(run(undefined, TEAM_ID));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID));
    const failure = new Error('boom');
    svc.restore.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin'), TEAM_ID));
    expect(error.code).toBe('team.restore.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.restore');
  });
});
