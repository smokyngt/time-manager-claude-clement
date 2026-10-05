import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';

import { FakeDb } from '../../../support/db.js';

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

const { remove } = await import('@/services/team-member/remove.js');

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
const USER_ID = '00000000-0000-4000-8000-0000000000c2';
const MISSING_ID = '00000000-0000-4000-8000-0000000000ff';

const admin: Actor = {
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'admin',
  team_ids: [],
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

describe('team.member.service.remove', () => {
  it('removes members, reports non members and writes an audit log', async () => {
    fakeDb.enqueue([{ user_id: USER_ID }]);
    const result = await remove({
      actor: admin,
      id: TEAM_ID,
      user_ids: [USER_ID, MISSING_ID, USER_ID],
    });
    expect(result).toEqual({
      failed: [{ code: 'team.member.not.found', id: MISSING_ID }],
      removed: [USER_ID],
      success: false,
    });
    expect(logCreate).toHaveBeenCalledWith({
      actor: admin,
      event: 'team.members.removed',
      metadata: { failed: 1, removed: 1, team_id: TEAM_ID },
    });
  });

  it('succeeds when every user was a member', async () => {
    fakeDb.enqueue([{ user_id: USER_ID }]);
    const result = await remove({ actor: admin, id: TEAM_ID, user_ids: [USER_ID] });
    expect(result).toEqual({ failed: [], removed: [USER_ID], success: true });
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(remove({ actor: admin, id: TEAM_ID, user_ids: [USER_ID] }));
    expect(error.code).toBe('team.member.remove.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.member.service.remove');
    expect(logCreate).not.toHaveBeenCalled();
  });
});
