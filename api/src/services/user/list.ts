import { and, eq, gte, inArray, isNotNull, isNull, lte, notInArray, or } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers, teams } from '@/db/schema/index.js';
import { users } from '@/db/schema/index.js';
import { UserListError } from '@/lib/errors/index.js';
import { Cursor } from '@/utils/http/cursor.js';
import { UserMapper } from '@/utils/mappers/user.js';

import type { ListUsersParams, ListUsersResponse } from './index.js';

/**
 * @route user.service.list
 * @param {ListUsersParams} params
 * @returns {Promise<ListUsersResponse>}
 * @throws {UserListError}
 */
export const list = async (params: ListUsersParams): Promise<ListUsersResponse> => {
  try {
    const { cursor, filters, limit, order } = params;
    const {
      archived,
      created_after: after,
      created_before: before,
      ids,
      managed_by: managerId,
      role,
      team_id: teamId,
    } = filters;
    const activeMembers = db
      .select({ user_id: teamMembers.user_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(isNull(teams.archived_at));
    const managedMembers = db
      .select({ user_id: teamMembers.user_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(and(eq(teams.manager_id, managerId ?? ''), isNull(teams.archived_at)));
    const teamMembersOf = db
      .select({ user_id: teamMembers.user_id })
      .from(teamMembers)
      .where(eq(teamMembers.team_id, teamId ?? ''));
    const where = and(
      ids === undefined ? undefined : inArray(users.id, ids),
      role === undefined ? undefined : eq(users.role, role),
      managerId === undefined
        ? undefined
        : or(
            eq(users.id, managerId),
            inArray(users.id, managedMembers),
            and(eq(users.role, 'employee'), notInArray(users.id, activeMembers)),
          ),
      teamId === undefined ? undefined : inArray(users.id, teamMembersOf),
      after === undefined ? undefined : gte(users.created_at, after),
      before === undefined ? undefined : lte(users.created_at, before),
      archived === undefined
        ? undefined
        : archived
          ? isNotNull(users.archived_at)
          : isNull(users.archived_at),
    );
    const page = await Cursor.paginate(users, {
      cursor,
      filters: where,
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
    throw UserListError({ cause: error, metadata: { route: 'user.service.list' } });
  }
};
