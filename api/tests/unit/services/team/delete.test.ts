import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor } from '../../../helpers/fixtures.js';
import { MISSING_TEAM_ID, TEAM_ID } from './fixtures.js';

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

const { remove } = await import('@/services/team/delete.js');

const actor = makeActor('admin');

describe('team.service.delete', () => {
  it('deletes the team and writes an audit log', async () => {
    fakeDb.enqueue([{ id: TEAM_ID }]);
    const result = await remove({ actor, id: TEAM_ID });
    expect(result).toEqual({ success: true });
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'team.deleted',
      metadata: { team_id: TEAM_ID },
    });
  });

  it('throws TEAM_NOT_FOUND when nothing matches', async () => {
    fakeDb.enqueue([]);
    const error = await caught(remove({ actor, id: MISSING_TEAM_ID }));
    expect(error.code).toBe('TEAM_NOT_FOUND');
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(remove({ actor, id: TEAM_ID }));
    expect(error.code).toBe('TEAM_DELETE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.delete');
  });
});
