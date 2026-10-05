import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/index.js';
import { TeamDeleteError, TeamNotFoundError } from '@/lib/errors/index.js';
import { TeamDeleted } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';

import type { DeleteTeamParams, DeleteTeamResponse } from './index.js';

/**
 * @route team.service.delete
 * @param {DeleteTeamParams} params
 * @returns {Promise<DeleteTeamResponse>}
 * @throws {TeamDeleteError | TeamNotFoundError}
 */
export const remove = async (params: DeleteTeamParams): Promise<DeleteTeamResponse> => {
  try {
    const { actor, id } = params;
    const rows = await db.delete(teams).where(eq(teams.id, id)).returning({ id: teams.id });
    if (rows.length === 0) {
      throw TeamNotFoundError({ metadata: { route: 'team.service.delete', team_id: id } });
    }
    await Audit.record({ actor, event: TeamDeleted.code, metadata: { team_id: id } });

    return { success: true };
  } catch (error) {
    throw TeamDeleteError({ cause: error, metadata: { route: 'team.service.delete' } });
  }
};
