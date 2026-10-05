import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  caught,
  EMPLOYEE_ID,
  makeActor,
  makeReply,
  makeReq,
  MANAGER_ID,
  OTHER_ID,
} from '../../../helpers/fixtures.js';
import {
  installTeamService,
  makeTeam,
  MISSING_TEAM_ID,
  TEAM_ID,
} from '../../services/team/fixtures.js';
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

import type { RetrieveParams } from '@/controllers/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { retrieve } = await import('@/controllers/team/retrieve.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<Team> }>;
type Req = FastifyRequest<{ Params: RetrieveParams }>;

const run = async (actor: Actor | null, id: string) => {
  const { fake, reply } = makeReply<Rep>();
  await retrieve(makeReq<Req>({ actor, params: { id } }), reply);
  return fake;
};

describe('team.controller.retrieve', () => {
  it('lets an admin retrieve any team without a membership lookup', async () => {
    directory.set(TEAM_ID, makeTeam());
    const fake = await run(makeActor('admin'), TEAM_ID);
    expect(fake.sent).toMatchObject({ data: { id: TEAM_ID }, event: 'team.retrieved' });
    expect(membership.teams).not.toHaveBeenCalled();
  });

  it('lets a manager retrieve a team they manage', async () => {
    directory.set(TEAM_ID, makeTeam());
    const fake = await run(makeActor('manager'), TEAM_ID);
    expect(fake.sent).toMatchObject({ data: { id: TEAM_ID } });
  });

  it('lets a member retrieve their team', async () => {
    directory.set(TEAM_ID, makeTeam({ manager_id: OTHER_ID }));
    membership.teams.mockImplementationOnce(() => Promise.resolve([TEAM_ID]));
    const fake = await run(makeActor('employee'), TEAM_ID);
    expect(fake.sent).toMatchObject({ data: { id: TEAM_ID } });
  });

  it('lets a manager who is only a member retrieve the team', async () => {
    directory.set(TEAM_ID, makeTeam({ manager_id: OTHER_ID }));
    membership.teams.mockImplementationOnce(() => Promise.resolve([TEAM_ID]));
    const fake = await run(makeActor('manager', MANAGER_ID), TEAM_ID);
    expect(fake.sent).toMatchObject({ data: { id: TEAM_ID } });
  });

  it('forbids an employee who is not a member', async () => {
    directory.set(TEAM_ID, makeTeam());
    const error = await caught(run(makeActor('employee', EMPLOYEE_ID), TEAM_ID));
    expect(error.code).toBe('FORBIDDEN');
  });

  it('forbids a manager who neither manages nor belongs to the team', async () => {
    directory.set(TEAM_ID, makeTeam({ manager_id: OTHER_ID }));
    const error = await caught(run(makeActor('manager'), TEAM_ID));
    expect(error.code).toBe('FORBIDDEN');
  });

  it('keeps the 404 raised by the service', async () => {
    const error = await caught(run(makeActor('admin'), MISSING_TEAM_ID));
    expect(error.code).toBe('TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    svc.retrieve.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('admin'), TEAM_ID));
    expect(error.code).toBe('TEAM_RETRIEVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.retrieve');
  });
});
