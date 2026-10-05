import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq, OTHER_ID } from '../../../helpers/fixtures.js';
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

import type { ArchiveParams } from '@/controllers/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { archive } = await import('@/controllers/team/archive.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<Team> }>;
type Req = FastifyRequest<{ Params: ArchiveParams }>;

const run = async (actor: Actor | null, id: string) => {
  const { fake, reply } = makeReply<Rep>();
  await archive(makeReq<Req>({ actor, params: { id } }), reply);
  return fake;
};

describe('team.controller.archive', () => {
  it('lets an admin archive any team', async () => {
    directory.set(TEAM_ID, makeTeam());
    const fake = await run(makeActor('admin'), TEAM_ID);
    expect(svc.archive).toHaveBeenCalledTimes(1);
    expect(fake.sent).toMatchObject({ data: { id: TEAM_ID }, event: 'team.archived' });
  });

  it('lets a manager archive a team they manage', async () => {
    directory.set(TEAM_ID, makeTeam());
    const fake = await run(makeActor('manager'), TEAM_ID);
    expect(fake.sent).toMatchObject({ event: 'team.archived' });
  });

  it('forbids a manager from touching a team managed by someone else', async () => {
    directory.set(TEAM_ID, makeTeam({ manager_id: OTHER_ID }));
    const error = await caught(run(makeActor('manager'), TEAM_ID));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.archive).not.toHaveBeenCalled();
  });

  it('forbids an employee', async () => {
    directory.set(TEAM_ID, makeTeam());
    const error = await caught(run(makeActor('employee'), TEAM_ID));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.archive).not.toHaveBeenCalled();
  });

  it('keeps the 404 raised by the service', async () => {
    const error = await caught(run(makeActor('admin'), MISSING_TEAM_ID));
    expect(error.code).toBe('TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('wraps service failures and keeps the cause', async () => {
    directory.set(TEAM_ID, makeTeam());
    const failure = new Error('db down');
    svc.archive.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(makeActor('admin'), TEAM_ID));
    expect(error.code).toBe('TEAM_ARCHIVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.archive');
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, TEAM_ID));
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
