import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/index.js';
import { TeamNotFoundError, TeamRestoreError } from '@/lib/errors/index.js';
import { TeamRestored } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { TeamMapper } from '@/utils/mappers/team.js';

import { TeamQuery } from './query.js';

import type { RestoreTeamParams, RestoreTeamResponse } from './index.js';

/**
 * @route team.service.restore
 * @param {RestoreTeamParams} params
 * @returns {Promise<RestoreTeamResponse>}
 * @throws {TeamNotFoundError | TeamRestoreError}
 */
export const restore = async (params: RestoreTeamParams): Promise<RestoreTeamResponse> => {
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
    await Audit.record({ actor, event: TeamRestored.code, metadata: { team_id: id } });

    return { team: TeamMapper.entity(row, await TeamQuery.count(id)) };
  } catch (error) {
    throw TeamRestoreError({ cause: error, metadata: { route: 'team.service.restore' } });
  }
};
