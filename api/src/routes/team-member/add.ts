import { teamMemberController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import {
  TeamMemberAddBodySchema,
  TeamMemberIdParamsSchema,
  TeamMemberResponses,
} from '@/schemas/index.js';

import type { AddTeamMembersBody, AddTeamMembersParams, AddTeamMembersResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const add: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: AddTeamMembersBody; Params: AddTeamMembersParams; Reply: ReplyEnvelope<AddTeamMembersResponse> }>(
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
    teamMemberController.add,
  );
};

export { add };
