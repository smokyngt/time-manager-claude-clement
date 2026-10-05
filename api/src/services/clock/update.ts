import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { ClockNotFoundError, ClockUpdateError } from '@/lib/errors/domains/clock.js';
import { logService } from '@/services/log/index.js';
import { ClockMapper } from '@/utils/clock-mapper.js';

import { ClockRules } from './rules.js';

import type { UpdateParams, UpdateResponse } from './index.js';
import type { ClockInsert } from '@/db/schema/clock.js';

/**
 * @route clock.service.update
 * @param {UpdateParams} params
 * @returns {Promise<UpdateResponse>}
 * @throws {ClockUpdateError}
 */
export const update = async (params: UpdateParams): Promise<UpdateResponse> => {
  try {
    const { actor, data, id } = params;
    const now = Date.now();
    const [existing] = await db.select().from(clocks).where(eq(clocks.id, id)).limit(1);
    if (existing === undefined) {
      throw ClockNotFoundError({ metadata: { clock_id: id, route: 'clock.service.update' } });
    }
    const clockedIn = data.clocked_in_at ?? existing.clocked_in_at;
    const clockedOut = data.clocked_out_at ?? existing.clocked_out_at;
    if (data.clocked_in_at !== undefined || data.clocked_out_at !== undefined) {
      ClockRules.validate({ clockedIn, clockedOut, now });
      await ClockRules.overlap({ clockedIn, clockedOut, excludeId: id, userId: existing.user_id });
    }
    const values: Partial<ClockInsert> = { updated_at: now };
    if (data.clocked_in_at !== undefined) values.clocked_in_at = data.clocked_in_at;
    if (data.clocked_out_at !== undefined) values.clocked_out_at = data.clocked_out_at;
    if (data.note !== undefined) values.note = data.note;
    const [row] = await db.update(clocks).set(values).where(eq(clocks.id, id)).returning();
    if (row === undefined) {
      throw ClockNotFoundError({ metadata: { clock_id: id, route: 'clock.service.update' } });
    }
    await logService.create({
      actor,
      event: 'clock.updated',
      metadata: { clock_id: id, fields: Object.keys(data), user_id: row.user_id },
    });
    return { clock: ClockMapper.entity(row) };
  } catch (error) {
    throw ClockUpdateError({ cause: error, metadata: { route: 'clock.service.update' } });
  }
};
