import { mock } from 'bun:test';

import type { RefreshTokenRow } from '@/db/schema/refresh-token.js';

export { caught, MISSING_ID, OTHER_ID, rowOf } from '../user/support.js';

export const TENANT = '11111111-2222-4333-8444-555555555555';

export const installLog = async () => {
  const real = { ...(await import('@/services/log/index.js')) };
  const create = mock((_params: unknown) => Promise.resolve({ success: true }));
  await mock.module('@/services/log/index.js', () => ({
    ...real,
    logService: { create },
  }));

  return {
    create,
    events: (): string[] =>
      create.mock.calls.map(([entry]) =>
        typeof entry === 'object' && entry !== null && 'event' in entry ? String(entry.event) : '',
      ),
    restore: (): void => {
      void mock.module('@/services/log/index.js', () => real);
    },
  };
};

export const params = (node: unknown, out: unknown[] = []): unknown[] => {
  if (typeof node !== 'object' || node === null) return out;
  if ('queryChunks' in node && Array.isArray(node.queryChunks)) {
    for (const chunk of node.queryChunks) params(chunk, out);
  } else if ('value' in node && 'encoder' in node) {
    out.push(node.value);
  }

  return out;
};

export const storedOf = (overrides: Partial<RefreshTokenRow> = {}): RefreshTokenRow => ({
  created_at: 1,
  expires_at: Date.now() + 60_000,
  family_id: '00000000-0000-4000-8000-0000000000f1',
  id: '00000000-0000-4000-8000-0000000000f2',
  revoked_at: null,
  token_hash: 'hash',
  user_id: '00000000-0000-4000-8000-0000000000c2',
  ...overrides,
});
