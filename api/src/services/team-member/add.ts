import { inArray } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers } from '@/db/schema/team.js';
import { users } from '@/db/schema/user.js';
import {
  TeamMemberAddError,
  TeamMemberTeamArchivedError,
  TeamMemberUserArchivedError,
  TeamMemberUserNotFoundError,
} from '@/lib/errors/domains/team-member.js';
import { ForbiddenError } from '@/lib/errors/index.js';
import { logService } from '@/services/log/index.js';

import { TeamMemberAccess } from './access.js';

import type { AddParams, AddResponse, BulkFailure } from './index.js';

/**
 * @route team_member.service.add
 * @param {AddParams} params
 * @returns {Promise<AddResponse>}
 * @throws {TeamMemberAddError}
 */
export const add = async (params: AddParams): Promise<AddResponse> => {
  try {
    const { actor, id } = params;
    const userIds = [...new Set(params.user_ids)];
    const team = await TeamMemberAccess.load(id, 'team_member.service.add');
    TeamMemberAccess.manage(actor, team, 'team_member.service.add');
    if (team.archived_at !== null) {
      throw TeamMemberTeamArchivedError({
        metadata: { route: 'team_member.service.add', team_id: id },
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
      if (actor.role === 'manager' && row.role !== 'employee') {
        throw ForbiddenError({
          metadata: { route: 'team_member.service.add', team_id: id, user_id: userId },
        });
      }
      eligible.push(userId);
    }
    const inserted =
      eligible.length === 0
        ? []
        : await db
            .insert(teamMembers)
            .values(eligible.map((userId) => ({ team_id: id, user_id: userId })))
            .onConflictDoNothing()
            .returning({ user_id: teamMembers.user_id });
    const added = inserted.map((row) => row.user_id);
    await logService.create({
      actor,
      event: 'team.members.added',
      metadata: { added: added.length, failed: failed.length, team_id: id },
    });

    return { added, failed, success: failed.length === 0 };
  } catch (error) {
    throw TeamMemberAddError({ cause: error, metadata: { route: 'team_member.service.add' } });
  }
};
