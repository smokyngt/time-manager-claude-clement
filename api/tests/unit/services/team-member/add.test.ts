import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';

import { FakeDb } from '../../../support/db.js';

import type { TeamRow } from '@/db/schema/team.js';
import type { Actor } from '@/types/entities/actor.js';

const realDb = { ...(await import('@/db/client.js')) };
const realLog = { ...(await import('@/services/log/index.js')) };
const fakeDb = new FakeDb();
const logCreate = mock(() => Promise.resolve({ success: true }));
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
await mock.module('@/services/log/index.js', () => ({
  ...realLog,
  logService: { create: logCreate },
}));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  void mock.module('@/services/log/index.js', () => realLog);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { add } = await import('@/services/team-member/add.js');

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
const USER_ID = '00000000-0000-4000-8000-0000000000c2';
const ARCHIVED_ID = '00000000-0000-4000-8000-0000000000c1';
const MISSING_ID = '00000000-0000-4000-8000-0000000000ff';

const manager: Actor = { id: MANAGER_ID, role: 'manager', team_ids: [] };

const team = (overrides: Partial<TeamRow> = {}): TeamRow => ({
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
  ...overrides,
});

const user = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  archived_at: null,
  id: USER_ID,
  role: 'employee',
  ...overrides,
});

const caught = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new TypeError('expected the promise to reject');
};

describe('team_member.service.add', () => {
  it('adds users, reports unknown and archived ones, and writes an audit log', async () => {
    fakeDb.enqueue([user(), user({ archived_at: 5, id: ARCHIVED_ID })], [{ user_id: USER_ID }]);
    const result = await add({
      actor: manager,
      roles: ['employee'],
      team: team(),
      user_ids: [USER_ID, ARCHIVED_ID, MISSING_ID, USER_ID],
    });
    expect(result).toEqual({
      added: [USER_ID],
      failed: [
        { code: 'team.member.user.archived', id: ARCHIVED_ID },
        { code: 'team.member.user.not.found', id: MISSING_ID },
      ],
      success: false,
    });
    expect(fakeDb.calls.some((call) => call.method === 'onConflictDoNothing')).toBe(true);
    expect(logCreate).toHaveBeenCalledWith({
      actor: manager,
      event: 'team.members.added',
      metadata: { added: 1, failed: 2, team_id: TEAM_ID },
    });
  });

  it('accepts a manager when the roles allow it', async () => {
    fakeDb.enqueue([user({ role: 'manager' })], [{ user_id: USER_ID }]);
    const result = await add({
      actor: manager,
      roles: ['employee', 'manager'],
      team: team(),
      user_ids: [USER_ID],
    });
    expect(result).toEqual({ added: [USER_ID], failed: [], success: true });
  });

  it('skips the insert when no user is eligible', async () => {
    fakeDb.enqueue([]);
    const result = await add({
      actor: manager,
      roles: ['employee'],
      team: team(),
      user_ids: [MISSING_ID],
    });
    expect(result.added).toEqual([]);
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('rejects a role outside the allowed roles before any insert', async () => {
    fakeDb.enqueue([user({ role: 'manager' })]);
    const error = await caught(
      add({ actor: manager, roles: ['employee'], team: team(), user_ids: [USER_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('throws team.member.team.archived for an archived team', async () => {
    const error = await caught(
      add({
        actor: manager,
        roles: ['employee'],
        team: team({ archived_at: 10 }),
        user_ids: [USER_ID],
      }),
    );
    expect(error.code).toBe('team.member.team.archived');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(
      add({ actor: manager, roles: ['employee'], team: team(), user_ids: [USER_ID] }),
    );
    expect(error.code).toBe('team.member.add.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team_member.service.add');
  });
});
