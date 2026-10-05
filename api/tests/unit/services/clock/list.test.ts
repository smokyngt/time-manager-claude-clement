import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught } from '../../../helpers/fixtures.js';
import { makeClockRow, OWNER_ID } from './fixtures.js';

const realCursor = { ...(await import('@/utils/cursor.js')) };
const paginate = mock(() =>
  Promise.resolve({ items: [makeClockRow()], more: true, next: 'abc', total: 5 }),
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

const { list } = await import('@/services/clock/list.js');

const calls = (): [unknown, Record<string, unknown>][] =>
  paginate.mock.calls as unknown as [unknown, Record<string, unknown>][];

describe('clock.service.list', () => {
  it('paginates and maps rows to public entities', async () => {
    const result = await list({
      filters: { from: 1, open: false, to: 2, user_ids: [OWNER_ID] },
      limit: 10,
      order: 'desc',
    });
    expect(result.more).toBe(true);
    expect(result.next).toBe('abc');
    expect(result.total).toBe(5);
    expect(result.items[0]?.object).toBe('clock');
    expect(result.items[0]?.duration_ms).toBe(28_800_000);
    expect(paginate).toHaveBeenCalledTimes(1);
    expect(calls()[0]?.[1]).toMatchObject({ limit: 10, order: 'desc', sort: 'created_at' });
    expect(calls()[0]?.[1]['filters']).toBeDefined();
  });

  it('filters open clocks', async () => {
    await list({ filters: { open: true }, limit: 5, order: 'asc' });
    expect(calls()[0]?.[1]['filters']).toBeDefined();
  });

  it('passes no filter when none is given', async () => {
    await list({ filters: {}, limit: 5, order: 'asc' });
    expect(calls()[0]?.[1]['filters']).toBeUndefined();
  });

  it('returns an empty page without querying when the user list is empty', async () => {
    const result = await list({ filters: { user_ids: [] }, limit: 5, order: 'asc' });
    expect(result).toEqual({ items: [], more: false, next: null, total: 0 });
    expect(paginate).not.toHaveBeenCalled();
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    paginate.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(list({ filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('CLOCK_LIST_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.list');
  });

  it('keeps a validation error raised by the cursor', async () => {
    const { ValidationError } = await import('@/lib/errors/index.js');
    paginate.mockImplementationOnce(() => Promise.reject(ValidationError()));
    const error = await caught(list({ cursor: 'bad', filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
  });
});
