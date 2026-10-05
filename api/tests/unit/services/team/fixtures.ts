import { mock } from 'bun:test';

import { TeamNotFoundError } from '@/lib/errors/domains/team.js';
import { TeamMapper } from '@/utils/team-mapper.js';

import type { TeamRow } from '@/db/schema/team.js';
import type { ListParams, TeamCreateData, TeamUpdateData } from '@/services/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Team } from '@/types/entities/team.js';

export const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
export const OTHER_TEAM_ID = '00000000-0000-4000-8000-0000000000e2';
export const MISSING_TEAM_ID = '00000000-0000-4000-8000-0000000000ef';

export const makeTeamRow = (overrides: Partial<TeamRow> = {}): TeamRow => ({
  archived_at: null,
  created_at: 1_700_000_000_000,
  description: null,
  id: TEAM_ID,
  manager_id: '00000000-0000-4000-8000-0000000000b1',
  name: 'Support',
  updated_at: null,
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
  ...overrides,
});

export const makeTeam = (overrides: Partial<TeamRow> = {}, members = 0): Team =>
  TeamMapper.entity(makeTeamRow(overrides), members);

export const installTeamService = async () => {
  const real = { ...(await import('@/services/team/index.js')) };
  const directory = new Map<string, Team>();
  const find = (id: string): Team => {
    const team = directory.get(id);
    if (team === undefined) throw TeamNotFoundError();
    return team;
  };
  const svc = {
    archive: mock((params: { actor: Actor; id: string }) =>
      Promise.resolve({ team: { ...find(params.id), archived_at: 1 } }),
    ),
    create: mock((params: { actor: Actor; data: TeamCreateData }) =>
      Promise.resolve({
        team: makeTeam({ id: OTHER_TEAM_ID, manager_id: params.data.manager_id }),
      }),
    ),
    delete: mock((params: { actor: Actor; id: string }) => {
      find(params.id);
      return Promise.resolve({ success: true });
    }),
    list: mock((_params: ListParams) =>
      Promise.resolve({ items: [] as Team[], more: false, next: null, total: 0 }),
    ),
    restore: mock((params: { actor: Actor; id: string }) =>
      Promise.resolve({ team: find(params.id) }),
    ),
    retrieve: mock((params: { id: string }) =>
      Promise.resolve().then(() => ({ team: find(params.id) })),
    ),
    update: mock((params: { actor: Actor; data: TeamUpdateData; id: string }) =>
      Promise.resolve({ team: find(params.id) }),
    ),
  };
  await mock.module('@/services/team/index.js', () => ({ ...real, teamService: svc }));
  return {
    directory,
    restore: (): void => {
      void mock.module('@/services/team/index.js', () => real);
    },
    svc,
  };
};
