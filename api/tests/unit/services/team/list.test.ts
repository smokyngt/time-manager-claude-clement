import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { caught, MANAGER_ID, rowOf, TEAM_ID } from './support.js';

const realCursor = { ...(await import('@/utils/http/cursor.js')) };
const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
const paginate = mock(() =>
  Promise.resolve({ items: [rowOf()], more: true, next: 'abc', total: 5 }),
);
await mock.module('@/utils/http/cursor.js', () => ({ ...realCursor, Cursor: { paginate } }));
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/utils/http/cursor.js', () => realCursor);
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { list } = await import('@/services/team/list.js');

const options = (): Record<string, unknown> =>
  (paginate.mock.calls as unknown as [unknown, Record<string, unknown>][])[0]?.[1] ?? {};

describe('team.service.list', () => {
  it('paginates by creation time and maps rows to decrypted entities with member counts', async () => {
    fakeDb.enqueue([{ id: TEAM_ID, total: 3 }]);
    const result = await list({ filters: { archived: false }, limit: 10, order: 'desc' });
    expect(result.more).toBe(true);
    expect(result.next).toBe('abc');
    expect(result.total).toBe(5);
    expect(result.items[0]).toMatchObject({ member_count: 3, name: 'Customer support', object: 'team' });
    expect(paginate).toHaveBeenCalledTimes(1);
    expect(options()).toMatchObject({ limit: 10, order: 'desc', sort: 'created_at' });
    expect(options()['filters']).toBeDefined();
  });

  it('uses a zero member count for a team without members', async () => {
    fakeDb.enqueue([]);
    const result = await list({ filters: {}, limit: 5, order: 'asc' });
    expect(result.items[0]?.member_count).toBe(0);
  });

  it('passes no filter when none is given', async () => {
    await list({ filters: {}, limit: 5, order: 'asc' });
    expect(options()['filters']).toBeUndefined();
  });

  it('builds a filter for the manager, the member and the visibility of a manager', async () => {
    await list({
      filters: {
        ids: [TEAM_ID],
        manager_id: MANAGER_ID,
        member_id: MANAGER_ID,
        visible_to: { id: MANAGER_ID, managed: true },
      },
      limit: 5,
      order: 'asc',
    });
    expect(options()['filters']).toBeDefined();
  });

  it('builds a membership filter for an employee', async () => {
    await list({
      filters: { created_after: 1, created_before: 2, visible_to: { id: MANAGER_ID, managed: false } },
      limit: 5,
      order: 'asc',
    });
    expect(options()['filters']).toBeDefined();
  });

  it('forwards the cursor', async () => {
    await list({ cursor: 'next-page', filters: {}, limit: 5, order: 'asc' });
    expect(options()['cursor']).toBe('next-page');
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    paginate.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(list({ filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('team.list.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.list');
  });

  it('keeps a validation error raised by the cursor', async () => {
    const { ValidationError } = await import('@/lib/errors/base/core.js');
    paginate.mockImplementationOnce(() => Promise.reject(ValidationError()));
    const error = await caught(list({ cursor: 'bad', filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('validation.error');
    expect(error.status).toBe(400);
  });
});
