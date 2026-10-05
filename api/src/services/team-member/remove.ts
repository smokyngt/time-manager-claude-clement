import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers } from '@/db/schema/team.js';
import {
  TeamMemberNotFoundError,
  TeamMemberRemoveError,
} from '@/lib/errors/domains/team-member.js';
import { logService } from '@/services/log/index.js';

import { TeamMemberAccess } from './access.js';

import type { BulkFailure, RemoveParams, RemoveResponse } from './index.js';

/**
 * @route team_member.service.remove
 * @param {RemoveParams} params
 * @returns {Promise<RemoveResponse>}
 * @throws {TeamMemberRemoveError}
 */
export const remove = async (params: RemoveParams): Promise<RemoveResponse> => {
  try {
    const { actor, id } = params;
    const userIds = [...new Set(params.user_ids)];
    const team = await TeamMemberAccess.load(id, 'team_member.service.remove');
    TeamMemberAccess.manage(actor, team, 'team_member.service.remove');
    const rows = await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.team_id, id), inArray(teamMembers.user_id, userIds)))
      .returning({ user_id: teamMembers.user_id });
    const removed = rows.map((row) => row.user_id);
    const done = new Set(removed);
    const failed: BulkFailure[] = userIds
      .filter((userId) => !done.has(userId))
      .map((userId) => ({ code: TeamMemberNotFoundError.code, id: userId }));
    await logService.create({
      actor,
      event: 'team.members.removed',
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
