import { TeamCreateError } from '@/lib/errors/index.js';
import { TeamCreated } from '@/lib/events/index.js';
import { teamService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { CreateTeamBody, TeamResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.create
 * @param {FastifyRequest<{ Body: CreateTeamBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamCreateError | UnauthorizedError}
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateTeamBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const managerId = actor.role === 'manager' ? actor.id : (req.body.manager_id ?? actor.id);
    Access.team.require(actor, 'create', { manager_id: managerId });
    const { team } = await teamService.create({
      actor,
      data: { ...req.body, manager_id: managerId },
    });
    await Reply.send(req, reply, TeamCreated({ payload: { actor: actor.id, team_id: team.id } }), {
      team,
    });
  } catch (error) {
    throw TeamCreateError({ cause: error, metadata: { route: 'team.controller.create' } });
  }
};
