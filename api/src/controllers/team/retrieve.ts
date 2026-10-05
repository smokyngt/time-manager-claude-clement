import { TeamNotFoundError, TeamRetrieveError } from '@/lib/errors/domains/team.js';
import { TeamRetrieved } from '@/lib/events/domains/team.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { RetrieveParams, TeamResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.retrieve
 * @param {FastifyRequest<{ Params: RetrieveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamNotFoundError | TeamRetrieveError | UnauthorizedError}
 */
export const retrieve = async (
  req: FastifyRequest<{ Params: RetrieveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    const { team } = await teamService.retrieve({ id });
    if (!(await Access.team.scope(actor, team))) {
      throw TeamNotFoundError({ metadata: { route: 'team.controller.retrieve', team_id: id } });
    }
    Access.team.require(actor, 'read', team);
    await Reply.send(req, reply, TeamRetrieved({ payload: { actor: actor.id, team_id: team.id } }), {
      team,
    });
  } catch (error) {
    throw TeamRetrieveError({ cause: error, metadata: { route: 'team.controller.retrieve' } });
  }
};
