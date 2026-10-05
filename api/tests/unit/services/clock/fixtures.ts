import type { ClockRow } from '@/db/schema/clock.js';

export const CLOCK_ID = '00000000-0000-4000-8000-0000000000e1';
export const OWNER_ID = '00000000-0000-4000-8000-0000000000c1';

export const makeClockRow = (overrides: Partial<ClockRow> = {}): ClockRow => ({
  clocked_in_at: 1_700_000_000_000,
  clocked_out_at: 1_700_028_800_000,
  created_at: 1_700_000_000_000,
  id: CLOCK_ID,
  note: null,
  source: 'clock',
  updated_at: null,
  user_id: OWNER_ID,
  ...overrides,
});
