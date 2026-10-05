import { and, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm';

import { clocks } from '@/db/schema/clock.js';
import { ClockListError } from '@/lib/errors/domains/clock.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { Cursor } from '@/utils/http/cursor.js';
import { ClockMapper } from '@/utils/mappers/clock.js';

import type { ListParams, ListResponse } from './index.js';

/**
 * @route clock.service.list
 * @param {ListParams} params
 * @returns {Promise<ListResponse>}
 * @throws {ClockListError}
 */
export const list = async (params: ListParams): Promise<ListResponse> => {
  try {
    const { cursor, filters, limit, order } = params;
    const { from, open, to, user_ids: userIds } = filters;
    if (userIds?.length === 0) return { items: [], more: false, next: null, total: 0 };
    const where = and(
      userIds === undefined ? undefined : inArray(clocks.user_id, userIds),
      from === undefined ? undefined : gte(clocks.clocked_in_at, from),
      to === undefined ? undefined : lte(clocks.clocked_in_at, to),
      open === undefined
        ? undefined
        : open
          ? isNull(clocks.clocked_out_at)
          : isNotNull(clocks.clocked_out_at),
    );
    const page = await Tracing.span('db.clock.list', () =>
      Cursor.paginate(clocks, { cursor, filters: where, limit, order, sort: 'created_at' }),
    );

    return {
      items: page.items.map((row) => ClockMapper.entity(row)),
      more: page.more,
      next: page.next,
      total: page.total,
    };
  } catch (error) {
    throw ClockListError({ cause: error, metadata: { route: 'clock.service.list' } });
  }
};
