import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';
import { teamMemberService } from '@/services/team-member/index.js';
import { Access } from '@/utils/auth/authz.js';

import { Fake } from '../../../support/fake.js';

import type { ListTeamMembersBody, ListTeamMembersParams, ListTeamMembersResponse } from '@/controllers/team-member/index.js';
import type { TeamRow } from '@/db/schema/team.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { list } = await import('@/controllers/team-member/list.js');

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
const EMPLOYEE_ID = '00000000-0000-4000-8000-0000000000c1';

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
  list: teamMemberService.list,
  team: teamMemberService.team,
  view: Access.teamMember.view.bind(Access.teamMember),
};
const listService = mock((_params: unknown) =>
  Promise.resolve({ items: [], more: false, next: null, total: 0 }),
);
const teamService = mock((_params: unknown) => Promise.resolve({ team }));
const view = mock((_actor: Actor, _team: TeamRow) => Promise.resolve());
teamMemberService.list = listService;
teamMemberService.team = teamService;
Access.teamMember.view = view;

afterAll(() => {
  teamMemberService.list = original.list;
  teamMemberService.team = original.team;
  Access.teamMember.view = original.view;
});

afterEach(() => {
  mock.clearAllMocks();
});

const actor: Actor = { id: EMPLOYEE_ID, role: 'employee', team_ids: [] };

const run = async (who: Actor | undefined, body: ListTeamMembersBody) => {
  const reply = Fake.reply<FastifyReply<{ Reply: ReplyEnvelope<ListTeamMembersResponse> }>>();
  const req = Fake.request({ actor: who, body, params: { id: TEAM_ID } });
  await list(req as FastifyRequest<{ Body: ListTeamMembersBody; Params: ListTeamMembersParams }>, reply);

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

describe('team_member.controller.list', () => {
  it('checks visibility, applies defaults and replies', async () => {
    const reply = await run(actor, {});
    expect(view).toHaveBeenCalledWith(actor, team);
    expect(listService).toHaveBeenCalledWith({
      cursor: undefined,
      id: TEAM_ID,
      limit: 25,
      order: 'desc',
    });
    expect((reply as unknown as { payload: unknown }).payload).toMatchObject({
      data: { items: [], more: false, next: null, total: 0 },
      event: {
        code: 'team.members.listed',
        payload: { actor: EMPLOYEE_ID, count: 0, team_id: TEAM_ID, total: 0 },
      },
    });
  });

  it('passes the requested page options', async () => {
    await run(actor, { cursor: 'abc', limit: 5, order: 'asc' });
    expect(listService).toHaveBeenCalledWith({
      cursor: 'abc',
      id: TEAM_ID,
      limit: 5,
      order: 'asc',
    });
  });

  it('stays 403 when the caller cannot see the team', async () => {
    const { UnauthorizedError } = await import('@/lib/errors/base/core.js');
    view.mockImplementationOnce(() => Promise.reject(UnauthorizedError()));
    const error = await caught(run(actor, {}));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(listService).not.toHaveBeenCalled();
  });

  it('keeps a not found team as 404', async () => {
    const { TeamMemberTeamNotFoundError } = await import('@/lib/errors/domains/team-member.js');
    teamService.mockImplementationOnce(() => Promise.reject(TeamMemberTeamNotFoundError()));
    const error = await caught(run(actor, {}));
    expect(error.code).toBe('team.member.team.not.found');
    expect(error.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const error = await caught(run(undefined, {}));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('wraps service failures and keeps the cause', async () => {
    const failure = new Error('boom');
    listService.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run(actor, {}));
    expect(error.code).toBe('team.member.list.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team_member.controller.list');
  });
});
