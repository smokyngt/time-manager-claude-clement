import { UnauthorizedError } from '@/lib/errors/base/core.js';
import { UserArchiveError, UserNotFoundError } from '@/lib/errors/domains/user.js';
import { UserArchived } from '@/lib/events/domains/user.js';
import { userService } from '@/services/user/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { ArchiveParams, UserResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.archive
 * @param {FastifyRequest<{ Params: ArchiveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UnauthorizedError | UserArchiveError | UserNotFoundError}
 */
export const archive = async (
  req: FastifyRequest<{ Params: ArchiveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    if (!Access.user.reach(actor, id)) {
      throw UnauthorizedError({ metadata: { route: 'user.controller.archive', user_id: id } });
    }
    const { user: target } = await userService.retrieve({ id });
    if (!(await Access.user.scope(actor, target))) {
      throw UserNotFoundError({ metadata: { route: 'user.controller.archive', user_id: id } });
    }
    Access.user.require(actor, 'archive', target);
    const { user } = await userService.archive({ actor, id });
    await Reply.send(req, reply, UserArchived({ payload: { actor: actor.id, user_id: user.id } }), { user });
  } catch (error) {
    throw UserArchiveError({ cause: error, metadata: { route: 'user.controller.archive' } });
  }
};
