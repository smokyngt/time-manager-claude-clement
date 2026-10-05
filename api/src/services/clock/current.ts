import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { ClockCurrentError } from '@/lib/errors/domains/clock.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { ClockMapper } from '@/utils/mappers/clock.js';

import type { CurrentParams, CurrentResponse } from './index.js';

/**
 * @route clock.service.current
 * @param {CurrentParams} params
 * @returns {Promise<CurrentResponse>}
 * @throws {ClockCurrentError}
 */
export const current = async (params: CurrentParams): Promise<CurrentResponse> => {
  try {
    const { actor } = params;
    const [row] = await Tracing.span('db.clock.current', () =>
      db
        .select()
        .from(clocks)
        .where(and(eq(clocks.user_id, actor.id), isNull(clocks.clocked_out_at)))
        .limit(1),
    );

    return { clock: row === undefined ? null : ClockMapper.entity(row) };
  } catch (error) {
    throw ClockCurrentError({ cause: error, metadata: { route: 'clock.service.current' } });
  }
};
