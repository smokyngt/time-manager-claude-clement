import { describe, expect, it } from 'bun:test';

import { ClockMapper } from '@/utils/mappers/clock.js';

import { rowOf, sealed } from './support.js';

describe('clock.mapper', () => {
  it('computes the duration and decrypts the note', () => {
    const clock = ClockMapper.entity(rowOf({ note: sealed('Client site') }));
    expect(clock).toEqual({
      clocked_in_at: 1_700_000_000_000,
      clocked_out_at: 1_700_028_800_000,
      created_at: 1_700_000_000_000,
      duration_ms: 28_800_000,
      id: '00000000-0000-4000-8000-0000000000f1',
      note: 'Client site',
      object: 'clock',
      source: 'clock',
      updated_at: null,
      user_id: '00000000-0000-4000-8000-0000000000c1',
    });
  });

  it('has no duration while the clock is open and keeps a null note', () => {
    const clock = ClockMapper.entity(rowOf({ clocked_out_at: null }));
    expect(clock.duration_ms).toBeNull();
    expect(clock.note).toBeNull();
  });

  it('fails with crypto.decrypt.failed on a tampered note', () => {
    let failure: unknown;
    try {
      ClockMapper.entity(rowOf({ note: 'plain' }));
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 'crypto.decrypt.failed', status: 500 });
  });
});
