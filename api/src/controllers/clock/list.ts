import { ClockListError } from '@/lib/errors/index.js';
import { ClockListed } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { clockService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';
import { Time } from '@/utils/time.js';

import type { ListClocksBody, ListClocksResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.list
 * @param {FastifyRequest<{ Body: ListClocksBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ListClocksResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockListError}
 */
export const list = async (
  req: FastifyRequest<{ Body: ListClocksBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ListClocksResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { cursor, from, limit, open, order, to, user_ids: requested } = req.body;
    const userIds = await Access.clock.users(actor, requested);
    const result = await clockService.list({
      cursor,
      filters: { from: Time.bound(from), open, to: Time.bound(to), user_ids: userIds },
      limit: limit ?? RequestLimits.limitDefault,
      order: order ?? 'desc',
    });
    await Reply.send(
      req,
      reply,
      ClockListed({
        payload: { actor: actor.id, count: result.items.length, total: result.total },
      }),
      result,
    );
  } catch (error) {
    throw ClockListError({ cause: error, metadata: { route: 'clock.controller.list' } });
  }
};
