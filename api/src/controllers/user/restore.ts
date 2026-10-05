import { UnauthorizedError } from '@/lib/errors/index.js';
import { UserNotFoundError, UserRestoreError } from '@/lib/errors/index.js';
import { UserRestored } from '@/lib/events/index.js';
import { userService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { RestoreUserParams, UserResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.restore
 * @param {FastifyRequest<{ Params: RestoreUserParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UnauthorizedError | UserRestoreError | UserNotFoundError}
 */
export const restore = async (
  req: FastifyRequest<{ Params: RestoreUserParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    if (!Access.user.reach(actor, id)) {
      throw UnauthorizedError({ metadata: { route: 'user.controller.restore', user_id: id } });
    }
    const { user: target } = await userService.retrieve({ id });
    if (!(await Access.user.scope(actor, target))) {
      throw UserNotFoundError({ metadata: { route: 'user.controller.restore', user_id: id } });
    }
    Access.user.require(actor, 'restore', target);
    const { user } = await userService.restore({ actor, id });
    await Reply.send(req, reply, UserRestored({ payload: { actor: actor.id, user_id: user.id } }), { user });
  } catch (error) {
    throw UserRestoreError({ cause: error, metadata: { route: 'user.controller.restore' } });
  }
};
