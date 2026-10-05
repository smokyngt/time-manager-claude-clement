import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/index.js';
import {
  TeamMemberListError,
  TeamMemberTeamNotFoundError,
} from '@/lib/errors/index.js';

import type { TeamMemberTeamParams, TeamMemberTeamResponse } from './index.js';

/**
 * @route team_member.service.team
 * @param {TeamMemberTeamParams} params
 * @returns {Promise<TeamMemberTeamResponse>}
 * @throws {TeamMemberTeamNotFoundError | TeamMemberListError}
 */
export const team = async (params: TeamMemberTeamParams): Promise<TeamMemberTeamResponse> => {
  try {
    const { id } = params;
    const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (row === undefined) {
      throw TeamMemberTeamNotFoundError({
        metadata: { route: 'team_member.service.team', team_id: id },
      });
    }

    return { team: row };
  } catch (error) {
    throw TeamMemberListError({ cause: error, metadata: { route: 'team_member.service.team' } });
  }
};
