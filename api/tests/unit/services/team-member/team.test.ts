import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';

import { FakeDb } from '../../../support/db.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { team } = await import('@/services/team-member/team.js');

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';

const row = {
  archived_at: null,
  created_at: 1_700_000_000_000,
  description: null,
  id: TEAM_ID,
  manager_id: '00000000-0000-4000-8000-0000000000b1',
  name: 'Team',
  updated_at: null,
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
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

describe('team_member.service.team', () => {
  it('returns the team row', async () => {
    fakeDb.enqueue([row]);
    const result = await team({ id: TEAM_ID });
    expect(result).toEqual({ team: row });
  });

  it('throws team.member.team.not.found for an unknown team', async () => {
    fakeDb.enqueue([]);
    const error = await caught(team({ id: TEAM_ID }));
    expect(error.code).toBe('team.member.team.not.found');
    expect(error.status).toBe(404);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(team({ id: TEAM_ID }));
    expect(error.code).toBe('team.member.list.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team_member.service.team');
  });
});
