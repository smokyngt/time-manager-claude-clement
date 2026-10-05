import { UserRestoreError } from '@/lib/errors/domains/user.js';
import { ForbiddenError } from '@/lib/errors/index.js';
import { UserRestored } from '@/lib/events/domains/user.js';
import { userService } from '@/services/user/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { RestoreParams } from './index.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.restore
 * @param {FastifyRequest<{ Params: RestoreParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<User> }>} reply
 * @returns {Promise<void>}
 * @throws {UserRestoreError}
 */
export const restore = async (
  req: FastifyRequest<{ Params: RestoreParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    if (!Access.user.reach(actor, id)) {
      throw ForbiddenError({ metadata: { route: 'user.controller.restore' } });
    }
    const { user: target } = await userService.retrieve({ id });
    Access.user.require(actor, 'restore', target);
    const { user } = await userService.restore({ actor, id });
    await Reply.send(req, reply, UserRestored({ payload: { user_id: user.id } }), user);
  } catch (error) {
    throw UserRestoreError({ cause: error, metadata: { route: 'user.controller.restore' } });
  }
};
