import { team } from '@/controllers/team/index.js';
import { auth } from '@/plugins/auth.js';
import { TeamResponses, TeamUpdateBodySchema } from '@/schemas/team.js';

import type { UpdateBody, UpdateResponse } from '@/controllers/team/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const updateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.patch<{ Body: UpdateBody; Reply: ReplyEnvelope<UpdateResponse> }>(
    '',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        body: TeamUpdateBodySchema,
        description:
          'Applies the same data to every id. Authorization is checked for every item before any write. Only an admin can change the manager.',
        response: TeamResponses.update,
        security: [{ bearerAuth: [] }],
        summary: 'Update teams in bulk',
        tags: ['teams'],
      },
    },
    team.update,
  );
};
