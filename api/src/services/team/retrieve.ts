import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import { TeamNotFoundError, TeamRetrieveError } from '@/lib/errors/domains/team.js';
import { TeamMapper } from '@/utils/team-mapper.js';

import { TeamQuery } from './query.js';

import type { RetrieveParams, RetrieveResponse } from './index.js';

/**
 * @route team.service.retrieve
 * @param {RetrieveParams} params
 * @returns {Promise<RetrieveResponse>}
 * @throws {TeamRetrieveError}
 */
export const retrieve = async (params: RetrieveParams): Promise<RetrieveResponse> => {
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
