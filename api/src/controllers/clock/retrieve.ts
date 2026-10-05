import { ClockNotFoundError, ClockRetrieveError } from '@/lib/errors/domains/clock.js';
import { ClockRetrieved } from '@/lib/events/domains/clock.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { ClockResponse, RetrieveParams } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.retrieve
 * @param {FastifyRequest<{ Params: RetrieveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockNotFoundError | ClockRetrieveError | UnauthorizedError}
 */
export const retrieve = async (
  req: FastifyRequest<{ Params: RetrieveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    const { clock } = await clockService.retrieve({ id });
    if (!(await Access.clock.scope(actor, clock))) {
      throw ClockNotFoundError({ metadata: { clock_id: id, route: 'clock.controller.retrieve' } });
    }
    await Access.clock.require(actor, 'read', clock);
    await Reply.send(req, reply, ClockRetrieved({ payload: { actor: actor.id, clock_id: clock.id } }), {
      clock,
    });
  } catch (error) {
    throw ClockRetrieveError({ cause: error, metadata: { route: 'clock.controller.retrieve' } });
  }
};
