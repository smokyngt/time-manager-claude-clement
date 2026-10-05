import { inArray } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers, users  } from '@/db/schema/index.js';
import { TeamMemberAddError,
  TeamMemberTeamArchivedError,
  TeamMemberUserArchivedError,
  TeamMemberUserNotFoundError,
  UnauthorizedError } from '@/lib/errors/index.js';
import { TeamMembersAdded } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';

import type { AddTeamMembersParams, AddTeamMembersResponse } from './index.js';
import type { BulkFailure } from '@/types/entities/index.js';

/**
 * @route team_member.service.add
 * @param {AddTeamMembersParams} params
 * @returns {Promise<AddTeamMembersResponse>}
 * @throws {TeamMemberTeamArchivedError | UnauthorizedError | TeamMemberAddError}
 */
export const add = async (params: AddTeamMembersParams): Promise<AddTeamMembersResponse> => {
  try {
    const { actor, roles, team } = params;
    const userIds = [...new Set(params.user_ids)];
    if (team.archived_at !== null) {
      throw TeamMemberTeamArchivedError({
        metadata: { route: 'team_member.service.add', team_id: team.id },
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
          metadata: { route: 'team_member.service.add', team_id: team.id, user_id: userId },
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
    await Audit.record({
      actor,
      event: TeamMembersAdded.code,
      metadata: { added: added.length, failed: failed.length, team_id: team.id },
    });

    return { added, failed, success: failed.length === 0 };
  } catch (error) {
    throw TeamMemberAddError({ cause: error, metadata: { route: 'team_member.service.add' } });
  }
};
