import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import { TeamArchiveError, TeamNotFoundError } from '@/lib/errors/domains/team.js';
import { logService } from '@/services/log/index.js';
import { TeamMapper } from '@/utils/team-mapper.js';

import { TeamQuery } from './query.js';

import type { ArchiveParams, ArchiveResponse } from './index.js';

/**
 * @route team.service.archive
 * @param {ArchiveParams} params
 * @returns {Promise<ArchiveResponse>}
 * @throws {TeamArchiveError}
 */
export const archive = async (params: ArchiveParams): Promise<ArchiveResponse> => {
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
    await logService.create({ actor, event: 'team.archived', metadata: { team_id: id } });
    return { team: TeamMapper.entity(row, await TeamQuery.count(id)) };
  } catch (error) {
    throw TeamArchiveError({ cause: error, metadata: { route: 'team.service.archive' } });
  }
};
