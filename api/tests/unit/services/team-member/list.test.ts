import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { ValidationError } from '@/lib/errors/base/core.js';
import { AppError } from '@/lib/errors/base/registry.js';

import { FakeDb } from '../../../support/db.js';

const realDb = { ...(await import('@/db/client.js')) };
const realCursor = { ...(await import('@/utils/http/cursor.js')) };
const fakeDb = new FakeDb();
const row = {
  archived_at: null,
  created_at: 1_700_000_000_000,
  email: 'jane.doe@example.com',
  first_name: 'Jane',
  id: '00000000-0000-4000-8000-0000000000c2',
  last_name: 'Doe',
  microsoft_id: null,
  password_hash: 'hash',
  phone_number: null,
  role: 'employee',
  updated_at: null,
};
const paginate = mock(() => Promise.resolve({ items: [row], more: true, next: 'abc', total: 5 }));
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
await mock.module('@/utils/http/cursor.js', () => ({ ...realCursor, Cursor: { paginate } }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  void mock.module('@/utils/http/cursor.js', () => realCursor);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { list } = await import('@/services/team-member/list.js');

const base = { id: '00000000-0000-4000-8000-0000000000e1', limit: 10, order: 'desc' } as const;

const caught = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new TypeError('expected the promise to reject');
};

describe('team.member.service.list', () => {
  it('paginates the members of the team', async () => {
    const result = await list(base);
    expect(result.more).toBe(true);
    expect(result.next).toBe('abc');
    expect(result.total).toBe(5);
    expect(result.items[0]?.object).toBe('user');
    expect(Object.keys(result.items[0] ?? {})).not.toContain('password_hash');
    const calls = paginate.mock.calls as unknown as [unknown, Record<string, unknown>][];
    expect(calls[0]?.[1]).toMatchObject({ limit: 10, order: 'desc', sort: 'created_at' });
    expect(calls[0]?.[1]['filters']).toBeDefined();
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    paginate.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(list(base));
    expect(error.code).toBe('team.member.list.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.member.service.list');
  });

  it('keeps a validation error raised by the cursor', async () => {
    paginate.mockImplementationOnce(() => Promise.reject(ValidationError()));
    const error = await caught(list({ ...base, cursor: 'bad' }));
    expect(error.code).toBe('validation.error');
    expect(error.status).toBe(400);
  });
});
