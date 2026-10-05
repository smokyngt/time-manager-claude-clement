import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { ClockConflictError, ClockOutError } from '@/lib/errors/domains/clock.js';
import { logService } from '@/services/log/index.js';
import { ClockMapper } from '@/utils/clock-mapper.js';

import { ClockRules } from './rules.js';

import type { OutParams, OutResponse } from './index.js';

/**
 * @route clock.service.out
 * @param {OutParams} params
 * @returns {Promise<OutResponse>}
 * @throws {ClockOutError}
 */
export const clockOut = async (params: OutParams): Promise<OutResponse> => {
  try {
    const { actor, note } = params;
    const now = Date.now();
    const [open] = await db
      .select()
      .from(clocks)
      .where(and(eq(clocks.user_id, actor.id), isNull(clocks.clocked_out_at)))
      .limit(1);
    if (open === undefined) {
      throw ClockConflictError({ metadata: { route: 'clock.service.out', user_id: actor.id } });
    }
    ClockRules.validate({ clockedIn: open.clocked_in_at, clockedOut: now, now });
    const [row] = await db
      .update(clocks)
      .set({ clocked_out_at: now, note: note ?? open.note, updated_at: now })
      .where(and(eq(clocks.id, open.id), isNull(clocks.clocked_out_at)))
      .returning();
    if (row === undefined) {
      throw ClockConflictError({ metadata: { route: 'clock.service.out', user_id: actor.id } });
    }
    await logService.create({
      actor,
      event: 'clock.out',
      metadata: { clock_id: row.id, user_id: actor.id },
    });
    return { clock: ClockMapper.entity(row) };
  } catch (error) {
    throw ClockOutError({ cause: error, metadata: { route: 'clock.service.out' } });
  }
};
