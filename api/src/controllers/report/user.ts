import { ReportUserError } from '@/lib/errors/domains/report.js';
import { ForbiddenError } from '@/lib/errors/index.js';
import { ReportUserGenerated } from '@/lib/events/domains/report.js';
import { reportService } from '@/services/report/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { UserBody } from './index.js';
import type { UserReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route report.controller.user
 * @param {FastifyRequest<{ Body: UserBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UserReport> }>} reply
 * @returns {Promise<void>}
 * @throws {ReportUserError}
 */
export const user = async (
  req: FastifyRequest<{ Body: UserBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UserReport> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { from, granularity, to, user_id: userId } = req.body;
    if (!Access.user.reach(actor, userId)) {
      throw ForbiddenError({ metadata: { route: 'report.controller.user' } });
    }
    const { report } = await reportService.user({ actor, from, granularity, to, user_id: userId });
    await Reply.send(req, reply, ReportUserGenerated({ payload: { user_id: userId } }), report);
  } catch (error) {
    throw ReportUserError({ cause: error, metadata: { route: 'report.controller.user' } });
  }
};
