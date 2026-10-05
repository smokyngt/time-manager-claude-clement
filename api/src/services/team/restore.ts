import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import { TeamNotFoundError, TeamRestoreError } from '@/lib/errors/domains/team.js';
import { TeamRestored } from '@/lib/events/domains/team.js';
import { logService } from '@/services/log/index.js';
import { TeamMapper } from '@/utils/mappers/team.js';

import { TeamQuery } from './query.js';

import type { RestoreParams, RestoreResponse } from './index.js';

/**
 * @route team.service.restore
 * @param {RestoreParams} params
 * @returns {Promise<RestoreResponse>}
 * @throws {TeamNotFoundError | TeamRestoreError}
 */
export const restore = async (params: RestoreParams): Promise<RestoreResponse> => {
  try {
    const { actor, id } = params;
    const [row] = await db
      .update(teams)
      .set({ archived_at: null, updated_at: Date.now() })
      .where(eq(teams.id, id))
      .returning();
    if (row === undefined) {
      throw TeamNotFoundError({ metadata: { route: 'team.service.restore', team_id: id } });
    }
    await logService.create({ actor, event: TeamRestored.code, metadata: { team_id: id } });

    return { team: TeamMapper.entity(row, await TeamQuery.count(id)) };
  } catch (error) {
    throw TeamRestoreError({ cause: error, metadata: { route: 'team.service.restore' } });
  }
};
