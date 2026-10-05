import { ReportTeamError } from '@/lib/errors/domains/report.js';
import { ReportTeamGenerated } from '@/lib/events/domains/report.js';
import { reportService } from '@/services/report/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { TeamBody } from './index.js';
import type { TeamReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route report.controller.team
 * @param {FastifyRequest<{ Body: TeamBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<TeamReport> }>} reply
 * @returns {Promise<void>}
 * @throws {ReportTeamError}
 */
export const team = async (
  req: FastifyRequest<{ Body: TeamBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<TeamReport> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const { from, granularity, team_id: teamId, to } = req.body;
    const { report } = await reportService.team({ actor, from, granularity, team_id: teamId, to });
    await Reply.send(req, reply, ReportTeamGenerated({ payload: { team_id: teamId } }), report);
  } catch (error) {
    throw ReportTeamError({ cause: error, metadata: { route: 'report.controller.team' } });
  }
};
