import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers } from '@/db/schema/index.js';
import {
  TeamMemberNotFoundError,
  TeamMemberRemoveError,
} from '@/lib/errors/index.js';
import { TeamMembersRemoved } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';

import type { RemoveTeamMembersParams, RemoveTeamMembersResponse } from './index.js';
import type { BulkFailure } from '@/types/entities/index.js';

/**
 * @route team_member.service.remove
 * @param {RemoveTeamMembersParams} params
 * @returns {Promise<RemoveTeamMembersResponse>}
 * @throws {TeamMemberRemoveError}
 */
export const remove = async (params: RemoveTeamMembersParams): Promise<RemoveTeamMembersResponse> => {
  try {
    const { actor, id } = params;
    const userIds = [...new Set(params.user_ids)];
    const rows = await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.team_id, id), inArray(teamMembers.user_id, userIds)))
      .returning({ user_id: teamMembers.user_id });
    const removed = rows.map((row) => row.user_id);
    const done = new Set(removed);
    const failed: BulkFailure[] = userIds
      .filter((userId) => !done.has(userId))
      .map((userId) => ({ code: TeamMemberNotFoundError.code, id: userId }));
    await Audit.record({
      actor,
      event: TeamMembersRemoved.code,
      metadata: { failed: failed.length, removed: removed.length, team_id: id },
    });

    return { failed, removed, success: failed.length === 0 };
  } catch (error) {
    throw TeamMemberRemoveError({
      cause: error,
      metadata: { route: 'team_member.service.remove' },
    });
  }
};
