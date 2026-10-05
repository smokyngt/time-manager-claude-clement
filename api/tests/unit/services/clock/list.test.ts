import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, OWNER_ID, rowOf, sealed } from './support.js';

const realCursor = { ...(await import('@/utils/http/cursor.js')) };
const paginate = mock(() =>
  Promise.resolve({ items: [rowOf({ note: sealed('Client site') })], more: true, next: 'abc', total: 5 }),
);
await mock.module('@/utils/http/cursor.js', () => ({
  ...realCursor,
  Cursor: { paginate },
}));

afterAll(() => {
  void mock.module('@/utils/http/cursor.js', () => realCursor);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { list } = await import('@/services/clock/list.js');

const options = (): Record<string, unknown> =>
  (paginate.mock.calls as unknown as [unknown, Record<string, unknown>][])[0]?.[1] ?? {};

describe('clock.service.list', () => {
  it('paginates by creation time and maps rows to decrypted entities', async () => {
    const result = await list({
      filters: { from: 1, open: false, to: 2, user_ids: [OWNER_ID] },
      limit: 10,
      order: 'desc',
    });
    expect(result).toMatchObject({ more: true, next: 'abc', total: 5 });
    expect(result.items[0]).toMatchObject({ note: 'Client site', object: 'clock' });
    expect(options()).toMatchObject({ limit: 10, order: 'desc', sort: 'created_at' });
    expect(options()['filters']).toBeDefined();
  });

  it('passes no filter when none is given', async () => {
    await list({ filters: {}, limit: 5, order: 'asc' });
    expect(options()['filters']).toBeUndefined();
  });

  it('builds a filter for open clocks', async () => {
    await list({ filters: { open: true }, limit: 5, order: 'asc' });
    expect(options()['filters']).toBeDefined();
  });

  it('returns an empty page without querying when no user is visible', async () => {
    const result = await list({ filters: { user_ids: [] }, limit: 5, order: 'asc' });
    expect(result).toEqual({ items: [], more: false, next: null, total: 0 });
    expect(paginate).not.toHaveBeenCalled();
  });

  it('forwards the cursor', async () => {
    await list({ cursor: 'next-page', filters: {}, limit: 5, order: 'asc' });
    expect(options()['cursor']).toBe('next-page');
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    paginate.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(list({ filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('clock.list.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.list');
  });

  it('keeps a validation error raised by the cursor', async () => {
    const { ValidationError } = await import('@/lib/errors/base/core.js');
    paginate.mockImplementationOnce(() => Promise.reject(ValidationError()));
    const error = await caught(list({ cursor: 'bad', filters: {}, limit: 5, order: 'asc' }));
    expect(error.code).toBe('validation.error');
    expect(error.status).toBe(400);
  });
});
