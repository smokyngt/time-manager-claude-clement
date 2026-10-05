import { AppError } from '@/lib/errors/base/registry.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { TeamMapper } from '@/utils/mappers/team.js';

import type { TeamRow } from '@/db/schema/team.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Team } from '@/types/entities/team.js';
import type { Role } from '@/types/entities/user.js';

export const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
export const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
export const OTHER_MANAGER_ID = '00000000-0000-4000-8000-0000000000b2';
export const EMPLOYEE_ID = '00000000-0000-4000-8000-0000000000c1';
export const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
export const OTHER_TEAM_ID = '00000000-0000-4000-8000-0000000000e2';
export const MISSING_ID = '00000000-0000-4000-8000-0000000000ff';

const IDS: Record<Role, string> = { admin: ADMIN_ID, employee: EMPLOYEE_ID, manager: MANAGER_ID };

export const actorOf = (role: Role, id: string = IDS[role]): Actor => ({ id, role, team_ids: [] });

export const rowOf = (overrides: Partial<TeamRow> = {}): TeamRow => ({
  archived_at: null,
  created_at: 1_700_000_000_000,
  description: Cipher.seal('Customer support team of the Paris office.'),
  id: TEAM_ID,
  manager_id: MANAGER_ID,
  name: Cipher.seal('Customer support'),
  updated_at: null,
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
  ...overrides,
});

export const teamOf = (id: string, managerId: string = MANAGER_ID, overrides: Partial<Team> = {}): Team => ({
  ...TeamMapper.entity(rowOf({ id, manager_id: managerId }), 2),
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
