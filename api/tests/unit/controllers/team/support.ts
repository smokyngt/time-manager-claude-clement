import { mock } from 'bun:test';

import { TeamNotFoundError } from '@/lib/errors/domains/team.js';

import { teamOf } from '../../services/team/support.js';

import type { ListParams, TeamCreateData, TeamUpdateData } from '@/services/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Team } from '@/types/entities/team.js';

export const installTeamService = async () => {
  const real = { ...(await import('@/services/team/index.js')) };
  const directory = new Map<string, Team>();
  const find = (id: string): Team => {
    const team = directory.get(id);
    if (team === undefined) throw TeamNotFoundError({ metadata: { route: 'test' } });

    return team;
  };
  const svc = {
    archive: mock((params: { actor: Actor; id: string }) =>
      Promise.resolve({ team: { ...find(params.id), archived_at: 1 } }),
    ),
    create: mock((params: { actor: Actor; data: TeamCreateData }) =>
      Promise.resolve({
        team: teamOf('00000000-0000-4000-8000-0000000000d1', params.data.manager_id),
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

export const installMembers = async () => {
  const { FakeDb } = await import('../../../support/db.js');
  const real = { ...(await import('@/db/client.js')) };
  const fakeDb = new FakeDb();
  await mock.module('@/db/client.js', () => ({ ...real, db: fakeDb }));

  return {
    fakeDb,
    member: (...flags: boolean[]): void => {
      fakeDb.enqueue(...flags.map((flag) => (flag ? [{ user_id: 'member' }] : [])));
    },
    restore: (): void => {
      void mock.module('@/db/client.js', () => real);
    },
  };
};
