import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/index.js';
import { ClockDeleteError, ClockNotFoundError } from '@/lib/errors/index.js';
import { ClockDeleted } from '@/lib/events/index.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { Audit } from '@/services/log/audit.js';

import type { DeleteClockParams, DeleteClockResponse } from './index.js';

/**
 * @route clock.service.delete
 * @param {DeleteClockParams} params
 * @returns {Promise<DeleteClockResponse>}
 * @throws {ClockDeleteError | ClockNotFoundError}
 */
export const remove = async (params: DeleteClockParams): Promise<DeleteClockResponse> => {
  try {
    const { actor, id } = params;
    const [row] = await Tracing.span('db.clock.delete', () =>
      db.delete(clocks).where(eq(clocks.id, id)).returning({ id: clocks.id, user_id: clocks.user_id }),
    );
    if (row === undefined) {
      throw ClockNotFoundError({ metadata: { clock_id: id, route: 'clock.service.delete' } });
    }
    await Audit.record({
      actor,
      event: ClockDeleted.code,
      metadata: { clock_id: id, user_id: row.user_id },
    });

    return { success: true };
  } catch (error) {
    throw ClockDeleteError({ cause: error, metadata: { route: 'clock.service.delete' } });
  }
};
