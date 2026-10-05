import { TeamMemberRemoveError } from '@/lib/errors/domains/team-member.js';
import { ValidationError } from '@/lib/errors/index.js';
import { TeamMembersRemoved } from '@/lib/events/domains/team-member.js';
import { RequestLimits } from '@/schemas/common.js';
import { teamMemberService } from '@/services/team-member/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { RemoveBody, RemoveParams, RemoveResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team_member.controller.remove
 * @param {FastifyRequest<{ Body: RemoveBody; Params: RemoveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<RemoveResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamMemberRemoveError}
 */
export const remove = async (
  req: FastifyRequest<{ Body: RemoveBody; Params: RemoveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<RemoveResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const userIds = [...new Set(req.body.user_ids)];
    if (userIds.length === 0 || userIds.length > RequestLimits.bulk) {
      throw ValidationError({
        metadata: { field: 'user_ids', route: 'team_member.controller.remove' },
      });
    }
    const result = await teamMemberService.remove({
      actor,
      id: req.params.id,
      user_ids: userIds,
    });
    await Reply.send(
      req,
      reply,
      TeamMembersRemoved({
        payload: { failed: result.failed.length, removed: result.removed.length },
      }),
      result,
    );
  } catch (error) {
    throw TeamMemberRemoveError({
      cause: error,
      metadata: { route: 'team_member.controller.remove' },
    });
  }
};
