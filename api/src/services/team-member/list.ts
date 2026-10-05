import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers } from '@/db/schema/team.js';
import { users } from '@/db/schema/user.js';
import { TeamMemberListError } from '@/lib/errors/domains/team-member.js';
import { Cursor } from '@/utils/cursor.js';
import { UserMapper } from '@/utils/user-mapper.js';

import { TeamMemberAccess } from './access.js';

import type { ListParams, ListResponse } from './index.js';

/**
 * @route team_member.service.list
 * @param {ListParams} params
 * @returns {Promise<ListResponse>}
 * @throws {TeamMemberListError}
 */
export const list = async (params: ListParams): Promise<ListResponse> => {
  try {
    const { actor, cursor, id, limit, order } = params;
    const team = await TeamMemberAccess.load(id, 'team_member.service.list');
    await TeamMemberAccess.view(actor, team, 'team_member.service.list');
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
