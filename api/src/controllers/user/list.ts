import { UserListError } from '@/lib/errors/domains/user.js';
import { ForbiddenError } from '@/lib/errors/index.js';
import { UserListed } from '@/lib/events/domains/user.js';
import { RequestLimits } from '@/schemas/common.js';
import { userService } from '@/services/user/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';
import { Time } from '@/utils/time.js';

import type { ListBody, ListResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.list
 * @param {FastifyRequest<{ Body: ListBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UserListError}
 */
export const list = async (
  req: FastifyRequest<{ Body: ListBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const { archived, cursor, ids, limit, order, role, team_id: teamId } = req.body;
    if (actor.role === 'manager' && role !== undefined && role !== 'employee') {
      throw ForbiddenError({ metadata: { route: 'user.controller.list' } });
    }
    const result = await userService.list({
      cursor,
      filters: {
        archived,
        created_after: Time.bound(req.body.created_after),
        created_before: Time.bound(req.body.created_before),
        ids,
        managed_by: actor.role === 'manager' ? actor.id : undefined,
        role: actor.role === 'manager' ? 'employee' : role,
        team_id: teamId,
      },
      limit: limit ?? RequestLimits.limitDefault,
      order: order ?? 'desc',
    });
    await Reply.send(
      req,
      reply,
      UserListed({ payload: { count: result.items.length, total: result.total } }),
      result,
    );
  } catch (error) {
    throw UserListError({ cause: error, metadata: { route: 'user.controller.list' } });
  }
};
