import { TeamArchiveError } from '@/lib/errors/domains/team.js';
import { TeamArchived } from '@/lib/events/domains/team.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/access.js';
import { teamAccess } from '@/utils/access/team.js';
import { Reply } from '@/utils/reply.js';

import type { ArchiveParams } from './index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.archive
 * @param {FastifyRequest<{ Params: ArchiveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<Team> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamArchiveError}
 */
export const archive = async (
  req: FastifyRequest<{ Params: ArchiveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<Team> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    const { team: target } = await teamService.retrieve({ id });
    teamAccess.require(actor, 'archive', target);
    const { team } = await teamService.archive({ actor, id });
    await Reply.send(req, reply, TeamArchived({ payload: { team_id: team.id } }), team);
  } catch (error) {
    throw TeamArchiveError({ cause: error, metadata: { route: 'team.controller.archive' } });
  }
};
