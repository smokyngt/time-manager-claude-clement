import { describe, expect, it } from 'bun:test';

import { Cursor } from '@/utils/cursor.js';

const ID = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';

describe('Cursor', () => {
  it('round-trips a position', () => {
    const encoded = Cursor.encode({ created_at: 1_700_000_000_000, id: ID });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Cursor.decode(encoded)).toEqual({ created_at: 1_700_000_000_000, id: ID });
  });

  it('rejects garbage with a validation error', () => {
    for (const bad of [
      '',
      'not-base64!!',
      Buffer.from('abc.def').toString('base64url'),
      Buffer.from(`x.${ID}`).toString('base64url'),
    ]) {
      let code = '';
      try {
        Cursor.decode(bad);
      } catch (error) {
        code = (error as { code: string }).code;
      }
      expect(code).toBe('VALIDATION_ERROR');
    }
  });
});
