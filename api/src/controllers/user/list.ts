import { UnauthorizedError, UserListError  } from '@/lib/errors/index.js';
import { UserListed } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { userService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';
import { Time } from '@/utils/time.js';

import type { ListUsersBody, ListUsersResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.list
 * @param {FastifyRequest<{ Body: ListUsersBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ListUsersResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UnauthorizedError | UserListError}
 */
export const list = async (
  req: FastifyRequest<{ Body: ListUsersBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ListUsersResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const { archived, cursor, ids, limit, order, role, team_id: teamId } = req.body;
    if (actor.role === 'manager' && role !== undefined && role !== 'employee') {
      throw UnauthorizedError({ metadata: { role, route: 'user.controller.list' } });
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
      UserListed({ payload: { actor: actor.id, count: result.items.length, total: result.total } }),
      result,
    );
  } catch (error) {
    throw UserListError({ cause: error, metadata: { route: 'user.controller.list' } });
  }
};
