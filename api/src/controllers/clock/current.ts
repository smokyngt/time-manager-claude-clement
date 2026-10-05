import { ClockCurrentError } from '@/lib/errors/domains/clock.js';
import { ClockCurrentRetrieved } from '@/lib/events/domains/clock.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { CurrentResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.current
 * @param {FastifyRequest} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<CurrentResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockCurrentError}
 */
export const current = async (
  req: FastifyRequest,
  reply: FastifyReply<{ Reply: ReplyEnvelope<CurrentResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { clock } = await clockService.current({ actor });
    await Reply.send(
      req,
      reply,
      ClockCurrentRetrieved({ payload: { actor: actor.id, open: clock !== null } }),
      { clock },
    );
  } catch (error) {
    throw ClockCurrentError({ cause: error, metadata: { route: 'clock.controller.current' } });
  }
};
