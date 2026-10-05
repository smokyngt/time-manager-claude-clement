import { TeamMemberAddError } from '@/lib/errors/domains/team-member.js';
import { ValidationError } from '@/lib/errors/index.js';
import { TeamMembersAdded } from '@/lib/events/domains/team-member.js';
import { RequestLimits } from '@/schemas/common.js';
import { teamMemberService } from '@/services/team-member/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { AddBody, AddParams, AddResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team_member.controller.add
 * @param {FastifyRequest<{ Body: AddBody; Params: AddParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<AddResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamMemberAddError}
 */
export const add = async (
  req: FastifyRequest<{ Body: AddBody; Params: AddParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<AddResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const userIds = [...new Set(req.body.user_ids)];
    if (userIds.length === 0 || userIds.length > RequestLimits.bulk) {
      throw ValidationError({
        metadata: { field: 'user_ids', route: 'team_member.controller.add' },
      });
    }
    const result = await teamMemberService.add({ actor, id: req.params.id, user_ids: userIds });
    await Reply.send(
      req,
      reply,
      TeamMembersAdded({
        payload: { added: result.added.length, failed: result.failed.length },
      }),
      result,
    );
  } catch (error) {
    throw TeamMemberAddError({
      cause: error,
      metadata: { route: 'team_member.controller.add' },
    });
  }
};
