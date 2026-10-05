import { teamMember } from '@/controllers/team-member/index.js';
import { auth } from '@/middlewares/auth/index.js';
import {
  TeamMemberAddBodySchema,
  TeamMemberIdParamsSchema,
  TeamMemberResponses,
} from '@/schemas/team-member.js';

import type { AddBody, AddParams, AddResponse } from '@/controllers/team-member/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const add: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: AddBody; Params: AddParams; Reply: ReplyEnvelope<AddResponse> }>(
    '/:id/members/add',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        body: TeamMemberAddBodySchema,
        description:
          'Add up to 100 employees to a team. Archived or unknown users are reported in failed. Admins, or the manager of the team.',
        params: TeamMemberIdParamsSchema,
        response: TeamMemberResponses.add,
        security: [{ bearerAuth: [] }],
        summary: 'Add members to a team',
        tags: ['team-members'],
      },
    },
    teamMember.add,
  );
};

export { add };
