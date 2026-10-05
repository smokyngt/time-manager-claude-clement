import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/index.js';
import { ClockNotFoundError, ClockRetrieveError } from '@/lib/errors/index.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { ClockMapper } from '@/utils/mappers/clock.js';

import type { RetrieveClockParams, RetrieveClockResponse } from './index.js';

/**
 * @route clock.service.retrieve
 * @param {RetrieveClockParams} params
 * @returns {Promise<RetrieveClockResponse>}
 * @throws {ClockNotFoundError | ClockRetrieveError}
 */
export const retrieve = async (params: RetrieveClockParams): Promise<RetrieveClockResponse> => {
  try {
    const { id } = params;
    const [row] = await Tracing.span('db.clock.retrieve', () =>
      db.select().from(clocks).where(eq(clocks.id, id)).limit(1),
    );
    if (row === undefined) {
      throw ClockNotFoundError({ metadata: { clock_id: id, route: 'clock.service.retrieve' } });
    }

    return { clock: ClockMapper.entity(row) };
  } catch (error) {
    throw ClockRetrieveError({ cause: error, metadata: { route: 'clock.service.retrieve' } });
  }
};
