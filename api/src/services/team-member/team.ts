import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import {
  TeamMemberListError,
  TeamMemberTeamNotFoundError,
} from '@/lib/errors/domains/team-member.js';

import type { TeamParams, TeamResponse } from './index.js';

/**
 * @route team.member.service.team
 * @param {TeamParams} params
 * @returns {Promise<TeamResponse>}
 * @throws {TeamMemberTeamNotFoundError | TeamMemberListError}
 */
export const team = async (params: TeamParams): Promise<TeamResponse> => {
  try {
    const { id } = params;
    const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (row === undefined) {
      throw TeamMemberTeamNotFoundError({
        metadata: { route: 'team.member.service.team', team_id: id },
      });
    }

    return { team: row };
  } catch (error) {
    throw TeamMemberListError({ cause: error, metadata: { route: 'team.member.service.team' } });
  }
};
