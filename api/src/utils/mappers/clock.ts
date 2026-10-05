import { Cipher } from '@/utils/crypto/cipher.js';

import type { ClockRow } from '@/db/schema/index.js';
import type { Clock } from '@/types/entities/index.js';

export class ClockMapper {
  /**
   * @route clock.mapper.entity
   * @param {ClockRow} row
   * @returns {Clock}
   * @throws {CryptoDecryptFailedError}
   */
  public static entity(row: ClockRow): Clock {
    return {
      clocked_in_at: row.clocked_in_at,
      clocked_out_at: row.clocked_out_at,
      created_at: row.created_at,
      duration_ms: row.clocked_out_at === null ? null : row.clocked_out_at - row.clocked_in_at,
      id: row.id,
      note: Cipher.nullable.open(row.note),
      object: 'clock',
      source: row.source,
      updated_at: row.updated_at,
      user_id: row.user_id,
    };
  }
}
