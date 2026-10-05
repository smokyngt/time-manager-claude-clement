import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import { TeamDeleteError, TeamNotFoundError } from '@/lib/errors/domains/team.js';
import { logService } from '@/services/log/index.js';

import type { DeleteParams, DeleteResponse } from './index.js';

/**
 * @route team.service.delete
 * @param {DeleteParams} params
 * @returns {Promise<DeleteResponse>}
 * @throws {TeamDeleteError}
 */
export const remove = async (params: DeleteParams): Promise<DeleteResponse> => {
  try {
    const { actor, id } = params;
    const rows = await db.delete(teams).where(eq(teams.id, id)).returning({ id: teams.id });
    if (rows.length === 0) {
      throw TeamNotFoundError({ metadata: { route: 'team.service.delete', team_id: id } });
    }
    await logService.create({ actor, event: 'team.deleted', metadata: { team_id: id } });
    return { success: true };
  } catch (error) {
    throw TeamDeleteError({ cause: error, metadata: { route: 'team.service.delete' } });
  }
};
