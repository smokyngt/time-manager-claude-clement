import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { ClockNotFoundError, ClockRetrieveError } from '@/lib/errors/domains/clock.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { ClockMapper } from '@/utils/mappers/clock.js';

import type { RetrieveParams, RetrieveResponse } from './index.js';

/**
 * @route clock.service.retrieve
 * @param {RetrieveParams} params
 * @returns {Promise<RetrieveResponse>}
 * @throws {ClockNotFoundError | ClockRetrieveError}
 */
export const retrieve = async (params: RetrieveParams): Promise<RetrieveResponse> => {
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
