import { ClockCreateError } from '@/lib/errors/index.js';
import { ClockCreated } from '@/lib/events/index.js';
import { clockService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { ClockResponse, CreateClockBody } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.create
 * @param {FastifyRequest<{ Body: CreateClockBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockCreateError | UnauthorizedError}
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateClockBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    await Access.clock.require(actor, 'create', { user_id: req.body.user_id });
    const { clock } = await clockService.create({ actor, data: req.body });
    await Reply.send(req, reply, ClockCreated({ payload: { actor: actor.id, clock_id: clock.id } }), {
      clock,
    });
  } catch (error) {
    throw ClockCreateError({ cause: error, metadata: { route: 'clock.controller.create' } });
  }
};
