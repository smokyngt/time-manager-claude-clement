import { UnauthorizedError } from '@/lib/errors/base/core.js';
import { ReportTeamError, ReportTeamNotFoundError } from '@/lib/errors/domains/report.js';
import { ReportTeamGenerated } from '@/lib/events/domains/report.js';
import { reportService } from '@/services/report/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';
import { Membership } from '@/utils/membership.js';

import type { TeamBody } from './index.js';
import type { TeamReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route report.controller.team
 * @param {FastifyRequest<{ Body: TeamBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<{ report: TeamReport }> }>} reply
 * @returns {Promise<void>}
 * @throws {ReportTeamError | ReportTeamNotFoundError | UnauthorizedError}
 */
export const team = async (
  req: FastifyRequest<{ Body: TeamBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<{ report: TeamReport }> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { from, granularity, team_id: teamId, to } = req.body;
    if (actor.role === 'employee') {
      const member = (await Membership.teams(actor.id)).includes(teamId);
      if (!member) {
        throw ReportTeamNotFoundError({
          metadata: { route: 'report.controller.team', team_id: teamId },
        });
      }
      throw UnauthorizedError({
        metadata: { role: actor.role, route: 'report.controller.team', team_id: teamId },
      });
    }
    const { report } = await reportService.team({
      from,
      granularity,
      manager_id: actor.role === 'manager' ? actor.id : undefined,
      team_id: teamId,
      to,
    });
    await Reply.send(
      req,
      reply,
      ReportTeamGenerated({ payload: { actor: actor.id, team_id: teamId } }),
      { report },
    );
  } catch (error) {
    throw ReportTeamError({ cause: error, metadata: { route: 'report.controller.team' } });
  }
};
