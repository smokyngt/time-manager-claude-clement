import { UserCreateError } from '@/lib/errors/index.js';
import { UserCreated } from '@/lib/events/index.js';
import { userService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { CreateUserBody, UserResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.create
 * @param {FastifyRequest<{ Body: CreateUserBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UnauthorizedError | UserCreateError}
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateUserBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    Access.user.require(actor, 'create', { role: req.body.role ?? 'employee' });
    const { user } = await userService.create({ actor, data: req.body });
    await Reply.send(req, reply, UserCreated({ payload: { actor: actor.id, user_id: user.id } }), {
      user,
    });
  } catch (error) {
    throw UserCreateError({ cause: error, metadata: { route: 'user.controller.create' } });
  }
};
