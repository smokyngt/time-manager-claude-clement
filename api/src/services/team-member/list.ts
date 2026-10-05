import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers, users  } from '@/db/schema/index.js';
import { TeamMemberListError } from '@/lib/errors/index.js';
import { Cursor } from '@/utils/http/cursor.js';
import { UserMapper } from '@/utils/mappers/user.js';

import type { ListTeamMembersParams, ListTeamMembersResponse } from './index.js';

/**
 * @route team_member.service.list
 * @param {ListTeamMembersParams} params
 * @returns {Promise<ListTeamMembersResponse>}
 * @throws {TeamMemberListError}
 */
export const list = async (params: ListTeamMembersParams): Promise<ListTeamMembersResponse> => {
  try {
    const { cursor, id, limit, order } = params;
    const members = db
      .select({ user_id: teamMembers.user_id })
      .from(teamMembers)
      .where(eq(teamMembers.team_id, id));
    const page = await Cursor.paginate(users, {
      cursor,
      filters: inArray(users.id, members),
      limit,
      order,
      sort: 'created_at',
    });

    return {
      items: page.items.map((row) => UserMapper.entity(row)),
      more: page.more,
      next: page.next,
      total: page.total,
    };
  } catch (error) {
    throw TeamMemberListError({ cause: error, metadata: { route: 'team_member.service.list' } });
  }
};
