import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/index.js';
import { ClockCurrentError } from '@/lib/errors/index.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { ClockMapper } from '@/utils/mappers/clock.js';

import type { CurrentClockParams, CurrentClockResponse } from './index.js';

/**
 * @route clock.service.current
 * @param {CurrentClockParams} params
 * @returns {Promise<CurrentClockResponse>}
 * @throws {ClockCurrentError}
 */
export const current = async (params: CurrentClockParams): Promise<CurrentClockResponse> => {
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
