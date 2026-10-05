import { AppError } from '@/lib/errors/base/registry.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { Digest } from '@/utils/crypto/digest.js';
import { UserMapper } from '@/utils/mappers/user.js';

import type { UserRow } from '@/db/schema/user.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Role, User } from '@/types/entities/user.js';

export const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
export const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
export const EMPLOYEE_ID = '00000000-0000-4000-8000-0000000000c1';
export const OTHER_ID = '00000000-0000-4000-8000-0000000000c2';
export const MISSING_ID = '00000000-0000-4000-8000-0000000000ff';
export const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';

const IDS: Record<Role, string> = { admin: ADMIN_ID, employee: EMPLOYEE_ID, manager: MANAGER_ID };

export const actorOf = (role: Role, id: string = IDS[role]): Actor => ({ id, role, team_ids: [] });

export const rowOf = (overrides: Partial<UserRow> = {}): UserRow => ({
  archived_at: null,
  created_at: 1_700_000_000_000,
  email: Cipher.seal('jane.doe@example.com'),
  email_hash: Digest.email('jane.doe@example.com'),
  first_name: Cipher.seal('Jane'),
  id: OTHER_ID,
  last_name: Cipher.seal('Doe'),
  microsoft_id: null,
  password_hash: 'hash',
  phone_number: null,
  role: 'employee',
  updated_at: null,
  ...overrides,
});

export const userOf = (role: Role, id: string, overrides: Partial<User> = {}): User => ({
  ...UserMapper.entity(rowOf({ id, role })),
  ...overrides,
});

export const caught = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new TypeError('expected the promise to reject');
};
