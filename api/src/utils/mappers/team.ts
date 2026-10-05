import { Cipher } from '@/utils/crypto/cipher.js';

import type { TeamRow } from '@/db/schema/index.js';
import type { Team } from '@/types/entities/index.js';

export class TeamMapper {
  /**
   * @route team.mapper.entity
   * @param {TeamRow} row
   * @param {number} memberCount
   * @returns {Team}
   * @throws {CryptoDecryptFailedError}
   */
  public static entity(row: TeamRow, memberCount: number): Team {
    return {
      archived_at: row.archived_at,
      created_at: row.created_at,
      description: Cipher.nullable.open(row.description),
      id: row.id,
      manager_id: row.manager_id,
      member_count: memberCount,
      name: Cipher.open(row.name),
      object: 'team',
      updated_at: row.updated_at,
      weekly_hours_target: row.weekly_hours_target,
      work_end: row.work_end,
      work_start: row.work_start,
    };
  }
}
