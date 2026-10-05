import { ReportUserError, ReportUserNotFoundError } from '@/lib/errors/domains/report.js';
import { ReportUserGenerated } from '@/lib/events/domains/report.js';
import { reportService } from '@/services/report/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';
import { Membership } from '@/utils/membership.js';

import type { UserBody } from './index.js';
import type { UserReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route report.controller.user
 * @param {FastifyRequest<{ Body: UserBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<{ report: UserReport }> }>} reply
 * @returns {Promise<void>}
 * @throws {ReportUserError | ReportUserNotFoundError}
 */
export const user = async (
  req: FastifyRequest<{ Body: UserBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<{ report: UserReport }> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { from, granularity, to, user_id: userId } = req.body;
    if (!(await Membership.reaches(actor, userId))) {
      throw ReportUserNotFoundError({
        metadata: { route: 'report.controller.user', user_id: userId },
      });
    }
    const { report } = await reportService.user({ from, granularity, to, user_id: userId });
    await Reply.send(
      req,
      reply,
      ReportUserGenerated({ payload: { actor: actor.id, user_id: userId } }),
      { report },
    );
  } catch (error) {
    throw ReportUserError({ cause: error, metadata: { route: 'report.controller.user' } });
  }
};
