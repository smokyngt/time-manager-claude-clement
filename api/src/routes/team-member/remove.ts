import { teamMember } from '@/controllers/team-member/index.js';
import { auth } from '@/middlewares/auth/index.js';
import {
  TeamMemberIdParamsSchema,
  TeamMemberRemoveBodySchema,
  TeamMemberResponses,
} from '@/schemas/team-member.js';

import type { RemoveBody, RemoveParams, RemoveResponse } from '@/controllers/team-member/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const remove: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: RemoveBody; Params: RemoveParams; Reply: ReplyEnvelope<RemoveResponse> }>(
    '/:id/members/remove',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        body: TeamMemberRemoveBodySchema,
        description: 'Remove up to 100 members from a team. Admins, or the manager of the team.',
        params: TeamMemberIdParamsSchema,
        response: TeamMemberResponses.remove,
        security: [{ bearerAuth: [] }],
        summary: 'Remove members from a team',
        tags: ['team-members'],
      },
    },
    teamMember.remove,
  );
};

export { remove };
