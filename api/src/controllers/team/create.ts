import { TeamCreateError } from '@/lib/errors/domains/team.js';
import { TeamCreated } from '@/lib/events/domains/team.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/access.js';
import { teamAccess } from '@/utils/access/team.js';
import { Reply } from '@/utils/reply.js';

import type { CreateBody } from './index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.create
 * @param {FastifyRequest<{ Body: CreateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<Team> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamCreateError}
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<Team> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const managerId = actor.role === 'manager' ? actor.id : (req.body.manager_id ?? actor.id);
    teamAccess.require(actor, 'create', { manager_id: managerId });
    const { team } = await teamService.create({
      actor,
      data: { ...req.body, manager_id: managerId },
    });
    await Reply.send(req, reply, TeamCreated({ payload: { team_id: team.id } }), team);
  } catch (error) {
    throw TeamCreateError({ cause: error, metadata: { route: 'team.controller.create' } });
  }
};
