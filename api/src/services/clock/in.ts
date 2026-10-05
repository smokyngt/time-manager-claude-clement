import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { ClockConflictError, ClockInError } from '@/lib/errors/domains/clock.js';
import { logService } from '@/services/log/index.js';
import { ClockMapper } from '@/utils/clock-mapper.js';
import { Postgres } from '@/utils/postgres.js';

import type { InParams, InResponse } from './index.js';

/**
 * @route clock.service.in
 * @param {InParams} params
 * @returns {Promise<InResponse>}
 * @throws {ClockInError}
 */
export const clockIn = async (params: InParams): Promise<InResponse> => {
  try {
    const { actor, note } = params;
    const [row] = await db
      .insert(clocks)
      .values({
        clocked_in_at: Date.now(),
        note: note ?? null,
        source: 'clock',
        user_id: actor.id,
      })
      .returning();
    if (row === undefined) throw ClockInError({ metadata: { route: 'clock.service.in' } });
    await logService.create({
      actor,
      event: 'clock.in',
      metadata: { clock_id: row.id, user_id: actor.id },
    });
    return { clock: ClockMapper.entity(row) };
  } catch (error) {
    const cause = Postgres.conflict(error) ? ClockConflictError({ cause: error }) : error;
    throw ClockInError({ cause, metadata: { route: 'clock.service.in' } });
  }
};
