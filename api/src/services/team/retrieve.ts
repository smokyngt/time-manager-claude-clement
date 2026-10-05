import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/index.js';
import { TeamNotFoundError, TeamRetrieveError } from '@/lib/errors/index.js';
import { TeamMapper } from '@/utils/mappers/team.js';

import { TeamQuery } from './query.js';

import type { RetrieveTeamParams, RetrieveTeamResponse } from './index.js';

/**
 * @route team.service.retrieve
 * @param {RetrieveTeamParams} params
 * @returns {Promise<RetrieveTeamResponse>}
 * @throws {TeamNotFoundError | TeamRetrieveError}
 */
export const retrieve = async (params: RetrieveTeamParams): Promise<RetrieveTeamResponse> => {
  try {
    const { id } = params;
    const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (row === undefined) {
      throw TeamNotFoundError({ metadata: { route: 'team.service.retrieve', team_id: id } });
    }

    return { team: TeamMapper.entity(row, await TeamQuery.count(id)) };
  } catch (error) {
    throw TeamRetrieveError({ cause: error, metadata: { route: 'team.service.retrieve' } });
  }
};
