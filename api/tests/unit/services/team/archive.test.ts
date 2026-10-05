import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { actorOf, caught, MISSING_ID, rowOf, TEAM_ID } from './support.js';

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

const actor = actorOf('admin');

describe('team.service.archive', () => {
  it('writes the change, returns the decrypted team and writes an audit log', async () => {
    fakeDb.enqueue([rowOf()], [{ total: 2 }]);
    const { team } = await archive({ actor, id: TEAM_ID });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(typeof values['updated_at']).toBe('number');
    expect(values['archived_at']).toBeNumber();
    expect(team).toMatchObject({ id: TEAM_ID, member_count: 2, name: 'Customer support' });
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'team.archived',
      metadata: { team_id: TEAM_ID },
    });
  });

  it('throws team.not.found when nothing matches', async () => {
    fakeDb.enqueue([]);
    const error = await caught(archive({ actor, id: MISSING_ID }));
    expect(error.code).toBe('team.not.found');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(archive({ actor, id: TEAM_ID }));
    expect(error.code).toBe('team.archive.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.archive');
  });
});
