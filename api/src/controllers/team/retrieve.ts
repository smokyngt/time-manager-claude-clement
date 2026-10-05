import { TeamRetrieveError } from '@/lib/errors/domains/team.js';
import { TeamRetrieved } from '@/lib/events/domains/team.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/access.js';
import { teamAccess } from '@/utils/access/team.js';
import { Membership } from '@/utils/membership.js';
import { Reply } from '@/utils/reply.js';

import type { RetrieveParams } from './index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.retrieve
 * @param {FastifyRequest<{ Params: RetrieveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<Team> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamRetrieveError}
 */
export const retrieve = async (
  req: FastifyRequest<{ Params: RetrieveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<Team> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    const { team } = await teamService.retrieve({ id });
    const member =
      actor.role === 'admin' ? false : (await Membership.teams(actor.id)).includes(team.id);
    teamAccess.require(actor, 'read', { id: team.id, manager_id: team.manager_id, member });
    await Reply.send(req, reply, TeamRetrieved({ payload: { team_id: team.id } }), team);
  } catch (error) {
    throw TeamRetrieveError({ cause: error, metadata: { route: 'team.controller.retrieve' } });
  }
};
