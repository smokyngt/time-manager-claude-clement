import { TeamArchiveError, TeamNotFoundError } from '@/lib/errors/domains/team.js';
import { TeamArchived } from '@/lib/events/domains/team.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { ArchiveParams, TeamResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.archive
 * @param {FastifyRequest<{ Params: ArchiveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamArchiveError | TeamNotFoundError | UnauthorizedError}
 */
export const archive = async (
  req: FastifyRequest<{ Params: ArchiveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    const { team: target } = await teamService.retrieve({ id });
    if (!(await Access.team.scope(actor, target))) {
      throw TeamNotFoundError({ metadata: { route: 'team.controller.archive', team_id: id } });
    }
    Access.team.require(actor, 'archive', target);
    const { team } = await teamService.archive({ actor, id });
    await Reply.send(req, reply, TeamArchived({ payload: { actor: actor.id, team_id: team.id } }), {
      team,
    });
  } catch (error) {
    throw TeamArchiveError({ cause: error, metadata: { route: 'team.controller.archive' } });
  }
};
