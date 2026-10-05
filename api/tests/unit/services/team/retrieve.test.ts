import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught } from '../../../helpers/fixtures.js';
import { makeTeamRow, MISSING_TEAM_ID, TEAM_ID } from './fixtures.js';

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

const { retrieve } = await import('@/services/team/retrieve.js');

describe('team.service.retrieve', () => {
  it('returns the entity with its member count', async () => {
    fakeDb.enqueue([makeTeamRow()], [{ id: TEAM_ID, total: 3 }]);
    const { team } = await retrieve({ id: TEAM_ID });
    expect(team.id).toBe(TEAM_ID);
    expect(team.object).toBe('team');
    expect(team.member_count).toBe(3);
  });

  it('throws TEAM_NOT_FOUND when the team does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(retrieve({ id: MISSING_TEAM_ID }));
    expect(error.code).toBe('TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(retrieve({ id: TEAM_ID }));
    expect(error.code).toBe('TEAM_RETRIEVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.retrieve');
  });
});
