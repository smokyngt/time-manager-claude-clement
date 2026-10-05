import { ClockOutError } from '@/lib/errors/index.js';
import { ClockStopped } from '@/lib/events/index.js';
import { clockService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { ClockOutBody, ClockResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.out
 * @param {FastifyRequest<{ Body: ClockOutBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockOutError}
 */
export const clockOut = async (
  req: FastifyRequest<{ Body: ClockOutBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { clock } = await clockService.clockOut({ actor, note: req.body.note });
    await Reply.send(req, reply, ClockStopped({ payload: { actor: actor.id, clock_id: clock.id } }), {
      clock,
    });
  } catch (error) {
    throw ClockOutError({ cause: error, metadata: { route: 'clock.controller.out' } });
  }
};
