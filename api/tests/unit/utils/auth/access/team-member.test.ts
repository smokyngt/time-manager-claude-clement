import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../../support/db.js';

import type { TeamRow } from '@/db/schema/team.js';
import type { Actor } from '@/types/entities/actor.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  fakeDb.reset();
});

const { TeamMemberAccess } = await import('@/utils/auth/access/team-member.js');

const access = new TeamMemberAccess();

const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
const actorOf = (role: Actor['role'], id: string): Actor => ({ id, role, team_ids: [] });
const team: TeamRow = {
  archived_at: null,
  created_at: 1_700_000_000_000,
  description: null,
  id: '00000000-0000-4000-8000-0000000000e1',
  manager_id: MANAGER_ID,
  name: 'Team',
  updated_at: null,
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
};

describe('access.team_member.manage', () => {
  it('allows an admin and the manager of the team', () => {
    expect(() => {
      access.manage(actorOf('admin', 'a'), team);
    }).not.toThrow();
    expect(() => {
      access.manage(actorOf('manager', MANAGER_ID), team);
    }).not.toThrow();
  });

  it('forbids another manager and employees', () => {
    expect(() => {
      access.manage(actorOf('manager', 'other'), team);
    }).toThrow();
    expect(() => {
      access.manage(actorOf('employee', MANAGER_ID), team);
    }).toThrow();
  });
});

describe('access.team_member.roles', () => {
  it('limits managers to employees', () => {
    expect(access.roles(actorOf('manager', MANAGER_ID))).toEqual(['employee']);
    expect(access.roles(actorOf('admin', 'a'))).toEqual(['admin', 'employee', 'manager']);
  });
});

describe('access.team_member.view', () => {
  it('allows an admin and the manager without a lookup', async () => {
    await access.view(actorOf('admin', 'a'), team);
    await access.view(actorOf('manager', MANAGER_ID), team);
    expect(fakeDb.calls).toHaveLength(0);
  });

  it('allows a member', async () => {
    fakeDb.enqueue([{ user_id: 'e' }]);
    await access.view(actorOf('employee', 'e'), team);
    expect(fakeDb.calls.length).toBeGreaterThan(0);
  });

  it('forbids a non member', async () => {
    fakeDb.enqueue([]);
    const error = await access.view(actorOf('employee', 'e'), team).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'unauthorized', status: 403 });
  });
});
