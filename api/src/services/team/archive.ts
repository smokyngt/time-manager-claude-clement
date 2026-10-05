import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/index.js';
import { TeamArchiveError, TeamNotFoundError } from '@/lib/errors/index.js';
import { TeamArchived } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { TeamMapper } from '@/utils/mappers/team.js';

import { TeamQuery } from './query.js';

import type { ArchiveTeamParams, ArchiveTeamResponse } from './index.js';

/**
 * @route team.service.archive
 * @param {ArchiveTeamParams} params
 * @returns {Promise<ArchiveTeamResponse>}
 * @throws {TeamArchiveError | TeamNotFoundError}
 */
export const archive = async (params: ArchiveTeamParams): Promise<ArchiveTeamResponse> => {
  try {
    const { actor, id } = params;
    const now = Date.now();
    const [row] = await db
      .update(teams)
      .set({ archived_at: now, updated_at: now })
      .where(eq(teams.id, id))
      .returning();
    if (row === undefined) {
      throw TeamNotFoundError({ metadata: { route: 'team.service.archive', team_id: id } });
    }
    await Audit.record({ actor, event: TeamArchived.code, metadata: { team_id: id } });

    return { team: TeamMapper.entity(row, await TeamQuery.count(id)) };
  } catch (error) {
    throw TeamArchiveError({ cause: error, metadata: { route: 'team.service.archive' } });
  }
};
