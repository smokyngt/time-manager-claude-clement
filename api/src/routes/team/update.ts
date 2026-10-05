import { team } from '@/controllers/team/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { TeamResponses, TeamUpdateBodySchema } from '@/schemas/team.js';

import type { UpdateBody, UpdateResponse } from '@/controllers/team/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const update: FastifyPluginAsync = async (fastify) => {
  fastify.patch<{ Body: UpdateBody; Reply: ReplyEnvelope<UpdateResponse> }>(
    '',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        body: TeamUpdateBodySchema,
        description:
          'Applies the same data to every id. Authorization is checked for every item before any write. Managers can only update teams they manage and cannot change the manager.',
        response: TeamResponses.update,
        security: [{ bearerAuth: [] }],
        summary: 'Update teams in bulk',
        tags: ['teams'],
      },
    },
    team.update,
  );
};

export { update };
