import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeRow } from '../../../helpers/fixtures.js';

const realCursor = { ...(await import('@/utils/cursor.js')) };
const paginate = mock(() =>
  Promise.resolve({ items: [makeRow()], more: true, next: 'abc', total: 5 }),
);
await mock.module('@/utils/cursor.js', () => ({
  ...realCursor,
  Cursor: { paginate },
}));

afterAll(() => {
  void mock.module('@/utils/cursor.js', () => realCursor);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { list } = await import('@/services/user/list.js');

describe('user.service.list', () => {
  it('paginates and maps rows to public entities', async () => {
    const result = await list({
      filters: { archived: false, role: 'employee' },
      limit: 10,
      order: 'desc',
    });
    expect(result.more).toBe(true);
    expect(result.next).toBe('abc');
    expect(result.total).toBe(5);
    expect(result.items[0]?.object).toBe('user');
    expect(Object.keys(result.items[0] ?? {})).not.toContain('password_hash');
    expect(paginate).toHaveBeenCalledTimes(1);
    const calls = paginate.mock.calls as unknown as [unknown, Record<string, unknown>][];
    expect(calls[0]?.[1]).toMatchObject({ limit: 10, order: 'desc', sort: 'created_at' });
    expect(calls[0]?.[1]['filters']).toBeDefined();
  });

  it('passes no filter when none is given', async () => {
    await list({ filters: {}, limit: 5, order: 'asc' });
    const calls = paginate.mock.calls as unknown as [unknown, Record<string, unknown>][];
    expect(calls[0]?.[1]['filters']).toBeUndefined();
  });

  it('builds a filter for team_id and manager scope', async () => {
    await list({
      filters: {
        managed_by: '00000000-0000-4000-8000-0000000000b1',
        team_id: '00000000-0000-4000-8000-0000000000e1',
      },
      limit: 5,
      order: 'asc',
    });
    const calls = paginate.mock.calls as unknown as [unknown, Record<string, unknown>][];
    expect(calls[0]?.[1]['filters']).toBeDefined();
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    paginate.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(list({ filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('USER_LIST_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.list');
  });

  it('keeps a validation error raised by the cursor', async () => {
    const { ValidationError } = await import('@/lib/errors/index.js');
    paginate.mockImplementationOnce(() => Promise.reject(ValidationError()));
    const error = await caught(list({ cursor: 'bad', filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
  });
});
