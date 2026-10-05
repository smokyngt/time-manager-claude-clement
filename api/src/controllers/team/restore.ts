import { TeamRestoreError, TeamNotFoundError } from '@/lib/errors/domains/team.js';
import { TeamRestored } from '@/lib/events/domains/team.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { RestoreParams, TeamResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.restore
 * @param {FastifyRequest<{ Params: RestoreParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamRestoreError | TeamNotFoundError | UnauthorizedError}
 */
export const restore = async (
  req: FastifyRequest<{ Params: RestoreParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    const { team: target } = await teamService.retrieve({ id });
    if (!(await Access.team.scope(actor, target))) {
      throw TeamNotFoundError({ metadata: { route: 'team.controller.restore', team_id: id } });
    }
    Access.team.require(actor, 'restore', target);
    const { team } = await teamService.restore({ actor, id });
    await Reply.send(req, reply, TeamRestored({ payload: { actor: actor.id, team_id: team.id } }), {
      team,
    });
  } catch (error) {
    throw TeamRestoreError({ cause: error, metadata: { route: 'team.controller.restore' } });
  }
};
