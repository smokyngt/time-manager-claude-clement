import { and, eq, gte, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';

import { teams } from '@/db/schema/team.js';
import { TeamListError } from '@/lib/errors/domains/team.js';
import { Cursor } from '@/utils/cursor.js';
import { TeamMapper } from '@/utils/team-mapper.js';

import { TeamQuery } from './query.js';

import type { ListParams, ListResponse } from './index.js';

/**
 * @route team.service.list
 * @param {ListParams} params
 * @returns {Promise<ListResponse>}
 * @throws {TeamListError}
 */
export const list = async (params: ListParams): Promise<ListResponse> => {
  try {
    const { cursor, filters, limit, order } = params;
    const {
      archived,
      created_after: after,
      created_before: before,
      ids,
      manager_id: managerId,
      member_id: memberId,
      visible_to: visible,
    } = filters;
    const where = and(
      ids === undefined ? undefined : inArray(teams.id, ids),
      managerId === undefined ? undefined : eq(teams.manager_id, managerId),
      memberId === undefined ? undefined : TeamQuery.member(memberId),
      visible === undefined
        ? undefined
        : visible.managed
          ? or(eq(teams.manager_id, visible.id), TeamQuery.member(visible.id))
          : TeamQuery.member(visible.id),
      after === undefined ? undefined : gte(teams.created_at, after),
      before === undefined ? undefined : lte(teams.created_at, before),
      archived === undefined
        ? undefined
        : archived
          ? isNotNull(teams.archived_at)
          : isNull(teams.archived_at),
    );
    const page = await Cursor.paginate(teams, {
      cursor,
      filters: where,
      limit,
      order,
      sort: 'created_at',
    });
    const counts = await TeamQuery.counts(page.items.map((row) => row.id));
    return {
      items: page.items.map((row) => TeamMapper.entity(row, counts.get(row.id) ?? 0)),
      more: page.more,
      next: page.next,
      total: page.total,
    };
  } catch (error) {
    throw TeamListError({ cause: error, metadata: { route: 'team.service.list' } });
  }
};
