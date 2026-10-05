import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import {
  actorOf,
  ADMIN_ID,
  caught,
  EMPLOYEE_ID,
  MANAGER_ID,
  MISSING_ID,
  OTHER_MANAGER_ID,
  teamOf,
  TEAM_ID,
} from '../../services/team/support.js';
import { installMembers, installTeamService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { RetrieveParams, TeamResponse } from '@/controllers/team/index.js';
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

const { retrieve } = await import('@/controllers/team/retrieve.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>;
type Req = FastifyRequest<{ Params: RetrieveParams }>;

const run = async (actor: Actor | undefined, id: string) => {
  const reply: FakeReply = Fake.reply();
  await retrieve(Fake.request({ actor, params: { id } }) as Req, reply as unknown as Rep);

  return reply;
};

describe('team.controller.retrieve', () => {
  it('lets an admin retrieve any team and replies with the named team', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID));
    const reply = await run(actorOf('admin'), TEAM_ID);
    expect(reply.payload).toMatchObject({
      data: { team: { id: TEAM_ID, object: 'team' } },
      event: {
        code: 'team.retrieved',
        correlation_id: 'req-test',
        payload: { actor: ADMIN_ID, team_id: TEAM_ID },
      },
    });
  });

  it('lets a manager retrieve a team they manage without a membership lookup', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID, MANAGER_ID));
    const reply = await run(actorOf('manager'), TEAM_ID);
    expect(reply.payload).toMatchObject({ data: { team: { id: TEAM_ID } } });
    expect(members.fakeDb.calls).toHaveLength(0);
  });

  it('lets a manager retrieve a team they belong to', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID, OTHER_MANAGER_ID));
    members.member(true);
    const reply = await run(actorOf('manager'), TEAM_ID);
    expect(reply.payload).toMatchObject({ data: { team: { id: TEAM_ID } } });
  });

  it('reports a team of another manager as not found to a manager', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID, OTHER_MANAGER_ID));
    const error = await caught(run(actorOf('manager'), TEAM_ID));
    expect(error.code).toBe('team.not.found');
    expect(error.status).toBe(404);
  });

  it('lets an employee retrieve a team they belong to', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID));
    members.member(true);
    const reply = await run(actorOf('employee', EMPLOYEE_ID), TEAM_ID);
    expect(reply.payload).toMatchObject({ data: { team: { id: TEAM_ID } } });
  });

  it('reports a team without the employee as not found', async () => {
    directory.set(TEAM_ID, teamOf(TEAM_ID));
    members.member(false);
    const error = await caught(run(actorOf('employee'), TEAM_ID));
    expect(error.code).toBe('team.not.found');
    expect(error.status).toBe(404);
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
    const failure = new Error('boom');
    svc.retrieve.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin'), TEAM_ID));
    expect(error.code).toBe('team.retrieve.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.retrieve');
  });
});
