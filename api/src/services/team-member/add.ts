import { inArray } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers } from '@/db/schema/team.js';
import { users } from '@/db/schema/user.js';
import { UnauthorizedError } from '@/lib/errors/base/core.js';
import {
  TeamMemberAddError,
  TeamMemberTeamArchivedError,
  TeamMemberUserArchivedError,
  TeamMemberUserNotFoundError,
} from '@/lib/errors/domains/team-member.js';
import { logService } from '@/services/log/index.js';

import type { AddParams, AddResponse, BulkFailure } from './index.js';

/**
 * @route team.member.service.add
 * @param {AddParams} params
 * @returns {Promise<AddResponse>}
 * @throws {TeamMemberTeamArchivedError | UnauthorizedError | TeamMemberAddError}
 */
export const add = async (params: AddParams): Promise<AddResponse> => {
  try {
    const { actor, roles, team } = params;
    const userIds = [...new Set(params.user_ids)];
    if (team.archived_at !== null) {
      throw TeamMemberTeamArchivedError({
        metadata: { route: 'team.member.service.add', team_id: team.id },
      });
    }
    const rows = await db.select().from(users).where(inArray(users.id, userIds));
    const found = new Map(rows.map((row) => [row.id, row]));
    const failed: BulkFailure[] = [];
    const eligible: string[] = [];
    for (const userId of userIds) {
      const row = found.get(userId);
      if (row === undefined) {
        failed.push({ code: TeamMemberUserNotFoundError.code, id: userId });
        continue;
      }
      if (row.archived_at !== null) {
        failed.push({ code: TeamMemberUserArchivedError.code, id: userId });
        continue;
      }
      if (!roles.includes(row.role)) {
        throw UnauthorizedError({
          metadata: { route: 'team.member.service.add', team_id: team.id, user_id: userId },
        });
      }
      eligible.push(userId);
    }
    const inserted =
      eligible.length === 0
        ? []
        : await db
            .insert(teamMembers)
            .values(eligible.map((userId) => ({ team_id: team.id, user_id: userId })))
            .onConflictDoNothing()
            .returning({ user_id: teamMembers.user_id });
    const added = inserted.map((row) => row.user_id);
    await logService.create({
      actor,
      event: 'team.members.added',
      metadata: { added: added.length, failed: failed.length, team_id: team.id },
    });

    return { added, failed, success: failed.length === 0 };
  } catch (error) {
    throw TeamMemberAddError({ cause: error, metadata: { route: 'team.member.service.add' } });
  }
};
