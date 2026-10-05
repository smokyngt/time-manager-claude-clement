import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { ClockDeleteError, ClockNotFoundError } from '@/lib/errors/domains/clock.js';
import { logService } from '@/services/log/index.js';

import type { DeleteParams, DeleteResponse } from './index.js';

/**
 * @route clock.service.delete
 * @param {DeleteParams} params
 * @returns {Promise<DeleteResponse>}
 * @throws {ClockDeleteError}
 */
export const remove = async (params: DeleteParams): Promise<DeleteResponse> => {
  try {
    const { actor, id } = params;
    const rows = await db
      .delete(clocks)
      .where(eq(clocks.id, id))
      .returning({ id: clocks.id, user_id: clocks.user_id });
    const [row] = rows;
    if (row === undefined) {
      throw ClockNotFoundError({ metadata: { clock_id: id, route: 'clock.service.delete' } });
    }
    await logService.create({
      actor,
      event: 'clock.deleted',
      metadata: { clock_id: id, user_id: row.user_id },
    });
    return { success: true };
  } catch (error) {
    throw ClockDeleteError({ cause: error, metadata: { route: 'clock.service.delete' } });
  }
};
