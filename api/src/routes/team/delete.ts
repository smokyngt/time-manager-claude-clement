import { team } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { TeamDeleteBodySchema, TeamResponses } from '@/schemas/index.js';

import type { DeleteTeamsBody, DeleteTeamsResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const deleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.delete<{ Body: DeleteTeamsBody; Reply: ReplyEnvelope<DeleteTeamsResponse> }>(
    '',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        body: TeamDeleteBodySchema,
        description:
          'Permanently deletes teams and their memberships. Admin only. Authorization is checked for every item before any deletion.',
        response: TeamResponses.delete,
        security: [{ bearerAuth: [] }],
        summary: 'Delete teams in bulk',
        tags: ['teams'],
      },
    },
    team.delete,
  );
};

export { deleteRoute };
