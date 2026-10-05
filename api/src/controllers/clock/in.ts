import { ClockInError } from '@/lib/errors/domains/clock.js';
import { ClockStarted } from '@/lib/events/domains/clock.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { ClockInBody, ClockResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.in
 * @param {FastifyRequest<{ Body: ClockInBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockInError}
 */
export const clockIn = async (
  req: FastifyRequest<{ Body: ClockInBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { clock } = await clockService.clockIn({ actor, note: req.body.note });
    await Reply.send(req, reply, ClockStarted({ payload: { actor: actor.id, clock_id: clock.id } }), {
      clock,
    });
  } catch (error) {
    throw ClockInError({ cause: error, metadata: { route: 'clock.controller.in' } });
  }
};
