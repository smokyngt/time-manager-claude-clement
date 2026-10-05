import type { ClockRow } from '@/db/schema/clock.js';
import type { Clock } from '@/types/entities/clock.js';

export class ClockMapper {
  /**
   * @route clock.mapper.entity
   * @param {ClockRow} row
   * @returns {Clock}
   */
  public static entity(row: ClockRow): Clock {
    return {
      clocked_in_at: row.clocked_in_at,
      clocked_out_at: row.clocked_out_at,
      created_at: row.created_at,
      duration_ms: row.clocked_out_at === null ? null : row.clocked_out_at - row.clocked_in_at,
      id: row.id,
      note: row.note,
      object: 'clock',
      source: row.source,
      updated_at: row.updated_at,
      user_id: row.user_id,
    };
  }
}
