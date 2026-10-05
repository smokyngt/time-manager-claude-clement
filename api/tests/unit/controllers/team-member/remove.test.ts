import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';
import { teamMemberService } from '@/services/team-member/index.js';

import { Fake } from '../../../support/fake.js';

import type { RemoveBody, RemoveParams, RemoveResponse } from '@/controllers/team-member/index.js';
import type { TeamRow } from '@/db/schema/team.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { remove } = await import('@/controllers/team-member/remove.js');

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
const USER_ID = '00000000-0000-4000-8000-0000000000c2';

const team: TeamRow = {
  archived_at: null,
  created_at: 1_700_000_000_000,
  description: null,
  id: TEAM_ID,
  manager_id: MANAGER_ID,
  name: 'Team',
  updated_at: null,
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
};

const original = {
  remove: teamMemberService.remove,
  team: teamMemberService.team,
};
const removeService = mock((_params: unknown) =>
  Promise.resolve({ failed: [], removed: [USER_ID], success: true }),
);
const teamService = mock((_params: unknown) => Promise.resolve({ team }));
teamMemberService.remove = removeService as unknown as typeof teamMemberService.remove;
teamMemberService.team = teamService as unknown as typeof teamMemberService.team;

afterAll(() => {
  teamMemberService.remove = original.remove;
  teamMemberService.team = original.team;
});

afterEach(() => {
  mock.clearAllMocks();
});

const actorOf = (role: Actor['role'], id = MANAGER_ID): Actor => ({ id, role, team_ids: [] });

const run = async (actor: Actor | undefined, body: RemoveBody) => {
  const reply = Fake.reply<FastifyReply<{ Reply: ReplyEnvelope<RemoveResponse> }>>();
  const req = Fake.request({ actor, body, params: { id: TEAM_ID } });
  await remove(req as FastifyRequest<{ Body: RemoveBody; Params: RemoveParams }>, reply);

  return reply;
};

const caught = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new TypeError('expected the promise to reject');
};

describe('team.member.controller.remove', () => {
  it('dedupes ids and replies', async () => {
    const actor = actorOf('manager');
    const reply = await run(actor, { user_ids: [USER_ID, USER_ID] });
    expect(removeService).toHaveBeenCalledWith({ actor, id: TEAM_ID, user_ids: [USER_ID] });
    expect((reply as unknown as { payload: unknown }).payload).toMatchObject({
      data: { failed: [], removed: [USER_ID], success: true },
      event: {
        code: 'team.members.removed',
        payload: { actor: MANAGER_ID, failed: 0, removed: 1, team_id: TEAM_ID },
      },
    });
  });

  it('lets an admin remove from any team', async () => {
    const actor = actorOf('admin', '00000000-0000-4000-8000-0000000000a1');
    await run(actor, { user_ids: [USER_ID] });
    expect(removeService).toHaveBeenCalledWith({ actor, id: TEAM_ID, user_ids: [USER_ID] });
  });

  it('forbids employees before loading the team', async () => {
    const error = await caught(run(actorOf('employee'), { user_ids: [USER_ID] }));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(teamService).not.toHaveBeenCalled();
    expect(removeService).not.toHaveBeenCalled();
  });

  it('forbids a manager of another team', async () => {
    const actor = actorOf('manager', '00000000-0000-4000-8000-0000000000b2');
    const error = await caught(run(actor, { user_ids: [USER_ID] }));
    expect(error.code).toBe('unauthorized');
    expect(removeService).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    const error = await caught(run(undefined, { user_ids: [USER_ID] }));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(actorOf('admin'), { user_ids: ids }));
    expect(error.code).toBe('validation.error');
    expect(removeService).not.toHaveBeenCalled();
  });

  it('keeps a not found team as 404', async () => {
    const { TeamMemberTeamNotFoundError } = await import('@/lib/errors/domains/team-member.js');
    teamService.mockImplementationOnce(() => Promise.reject(TeamMemberTeamNotFoundError()));
    const error = await caught(run(actorOf('admin'), { user_ids: [USER_ID] }));
    expect(error.code).toBe('team.member.team.not.found');
    expect(error.status).toBe(404);
  });

  it('wraps service failures and keeps the cause', async () => {
    const failure = new Error('boom');
    removeService.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actorOf('admin'), { user_ids: [USER_ID] }));
    expect(error.code).toBe('team.member.remove.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.member.controller.remove');
  });
});
