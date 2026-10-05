import { Cipher } from '@/utils/crypto/cipher.js';
import { ClockMapper } from '@/utils/mappers/clock.js';

import type { ClockRow } from '@/db/schema/clock.js';
import type { Clock } from '@/types/entities/clock.js';

export {
  actorOf,
  ADMIN_ID,
  caught,
  EMPLOYEE_ID,
  MANAGER_ID,
  MISSING_ID,
  OTHER_ID,
} from '../user/support.js';

export const CLOCK_ID = '00000000-0000-4000-8000-0000000000f1';
export const OTHER_CLOCK_ID = '00000000-0000-4000-8000-0000000000f2';
export const OWNER_ID = '00000000-0000-4000-8000-0000000000c1';

export const rowOf = (overrides: Partial<ClockRow> = {}): ClockRow => ({
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

export const sealed = (note: string): string => Cipher.seal(note);

export const clockOf = (userId: string, id: string, overrides: Partial<Clock> = {}): Clock => ({
  ...ClockMapper.entity(rowOf({ id, user_id: userId })),
  ...overrides,
});
