import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, MANAGER_ID } from '../../../helpers/fixtures.js';
import { makeTeamRow, TEAM_ID } from './fixtures.js';

const realCursor = { ...(await import('@/utils/cursor.js')) };
const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
const paginate = mock(() =>
  Promise.resolve({ items: [makeTeamRow()], more: true, next: 'abc', total: 5 }),
);
await mock.module('@/utils/cursor.js', () => ({ ...realCursor, Cursor: { paginate } }));
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/utils/cursor.js', () => realCursor);
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { list } = await import('@/services/team/list.js');

type PaginateCall = [unknown, Record<string, unknown>];

describe('team.service.list', () => {
  it('paginates and maps rows with their member counts', async () => {
    fakeDb.enqueue([{ id: TEAM_ID, total: 4 }]);
    const result = await list({
      filters: { archived: false, manager_id: MANAGER_ID, member_id: MANAGER_ID },
      limit: 10,
      order: 'desc',
    });
    expect(result.more).toBe(true);
    expect(result.next).toBe('abc');
    expect(result.total).toBe(5);
    expect(result.items[0]?.object).toBe('team');
    expect(result.items[0]?.member_count).toBe(4);
    const calls = paginate.mock.calls as unknown as PaginateCall[];
    expect(calls[0]?.[1]).toMatchObject({ limit: 10, order: 'desc', sort: 'created_at' });
    expect(calls[0]?.[1]['filters']).toBeDefined();
  });

  it('applies the visibility of a managing actor', async () => {
    fakeDb.enqueue([]);
    await list({
      filters: { visible_to: { id: MANAGER_ID, managed: true } },
      limit: 5,
      order: 'asc',
    });
    const calls = paginate.mock.calls as unknown as PaginateCall[];
    expect(calls[0]?.[1]['filters']).toBeDefined();
  });

  it('applies the visibility of a plain member', async () => {
    fakeDb.enqueue([]);
    await list({
      filters: { visible_to: { id: MANAGER_ID, managed: false } },
      limit: 5,
      order: 'asc',
    });
    const calls = paginate.mock.calls as unknown as PaginateCall[];
    expect(calls[0]?.[1]['filters']).toBeDefined();
  });

  it('passes no filter when none is given and defaults counts to zero', async () => {
    fakeDb.enqueue([]);
    const result = await list({ filters: {}, limit: 5, order: 'asc' });
    const calls = paginate.mock.calls as unknown as PaginateCall[];
    expect(calls[0]?.[1]['filters']).toBeUndefined();
    expect(result.items[0]?.member_count).toBe(0);
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    paginate.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(list({ filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('TEAM_LIST_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.list');
  });

  it('keeps a validation error raised by the cursor', async () => {
    const { ValidationError } = await import('@/lib/errors/index.js');
    paginate.mockImplementationOnce(() => Promise.reject(ValidationError()));
    const error = await caught(list({ cursor: 'bad', filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
  });
});
