import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { caught, MISSING_ID, rowOf, TEAM_ID } from './support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  fakeDb.reset();
});

const { retrieve } = await import('@/services/team/retrieve.js');

describe('team.service.retrieve', () => {
  it('returns the decrypted entity with its member count', async () => {
    fakeDb.enqueue([rowOf()], [{ total: 3 }]);
    const { team } = await retrieve({ id: TEAM_ID });
    expect(team).toMatchObject({
      description: 'Customer support team of the Paris office.',
      id: TEAM_ID,
      member_count: 3,
      name: 'Customer support',
      object: 'team',
    });
  });

  it('throws team.not.found for an unknown id', async () => {
    fakeDb.enqueue([]);
    const error = await caught(retrieve({ id: MISSING_ID }));
    expect(error.code).toBe('team.not.found');
    expect(error.status).toBe(404);
    expect(error.metadata['team_id']).toBe(MISSING_ID);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(retrieve({ id: TEAM_ID }));
    expect(error.code).toBe('team.retrieve.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.retrieve');
  });
});
