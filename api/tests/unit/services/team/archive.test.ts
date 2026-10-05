import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor } from '../../../helpers/fixtures.js';
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

const { archive } = await import('@/services/team/archive.js');

const actor = makeActor('admin');

describe('team.service.archive', () => {
  it('archives the team, returns the entity and writes an audit log', async () => {
    fakeDb.enqueue([makeTeamRow({ archived_at: 5 })], [{ id: TEAM_ID, total: 2 }]);
    const { team } = await archive({ actor, id: TEAM_ID });
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['archived_at']).toBeNumber();
    expect(team.member_count).toBe(2);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'team.archived',
      metadata: { team_id: TEAM_ID },
    });
  });

  it('throws TEAM_NOT_FOUND when nothing matches', async () => {
    fakeDb.enqueue([]);
    const error = await caught(archive({ actor, id: MISSING_TEAM_ID }));
    expect(error.code).toBe('TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(archive({ actor, id: TEAM_ID }));
    expect(error.code).toBe('TEAM_ARCHIVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.archive');
  });
});
