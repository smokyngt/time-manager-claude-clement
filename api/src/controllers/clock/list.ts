import { ClockListError } from '@/lib/errors/domains/clock.js';
import { ClockListed } from '@/lib/events/domains/clock.js';
import { RequestLimits } from '@/schemas/common.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/access.js';
import { clockAccess } from '@/utils/access/clock.js';
import { Reply } from '@/utils/reply.js';
import { Time } from '@/utils/time.js';

import type { ListBody, ListResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.list
 * @param {FastifyRequest<{ Body: ListBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockListError}
 */
export const list = async (
  req: FastifyRequest<{ Body: ListBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { cursor, from, limit, open, order, to, user_ids: requested } = req.body;
    const userIds = await clockAccess.users(actor, requested);
    const result = await clockService.list({
      cursor,
      filters: { from: Time.bound(from), open, to: Time.bound(to), user_ids: userIds },
      limit: limit ?? RequestLimits.limitDefault,
      order: order ?? 'desc',
    });
    await Reply.send(
      req,
      reply,
      ClockListed({ payload: { count: result.items.length, total: result.total } }),
      result,
    );
  } catch (error) {
    throw ClockListError({ cause: error, metadata: { route: 'clock.controller.list' } });
  }
};
