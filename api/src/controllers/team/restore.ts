import { TeamRestoreError } from '@/lib/errors/domains/team.js';
import { TeamRestored } from '@/lib/events/domains/team.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/access.js';
import { teamAccess } from '@/utils/access/team.js';
import { Reply } from '@/utils/reply.js';

import type { RestoreParams } from './index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.restore
 * @param {FastifyRequest<{ Params: RestoreParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<Team> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamRestoreError}
 */
export const restore = async (
  req: FastifyRequest<{ Params: RestoreParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<Team> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    const { team: target } = await teamService.retrieve({ id });
    teamAccess.require(actor, 'restore', target);
    const { team } = await teamService.restore({ actor, id });
    await Reply.send(req, reply, TeamRestored({ payload: { team_id: team.id } }), team);
  } catch (error) {
    throw TeamRestoreError({ cause: error, metadata: { route: 'team.controller.restore' } });
  }
};
