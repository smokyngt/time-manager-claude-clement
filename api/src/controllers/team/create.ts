import { TeamCreateError } from '@/lib/errors/domains/team.js';
import { TeamCreated } from '@/lib/events/domains/team.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { CreateBody, TeamResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.create
 * @param {FastifyRequest<{ Body: CreateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<TeamResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamCreateError | UnauthorizedError}
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateBody }>,
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
