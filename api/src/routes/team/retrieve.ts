import { team } from '@/controllers/team/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { TeamIdParamsSchema, TeamResponses } from '@/schemas/team.js';

import type { RetrieveParams, TeamResponse } from '@/controllers/team/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const retrieve: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: RetrieveParams; Reply: ReplyEnvelope<TeamResponse> }>(
    '/:id',
    {
      preHandler: auth({ scopes: ['teams:read'] }),
      schema: {
        description:
          'Admins can retrieve any team, managers the teams they manage or belong to, employees the teams they belong to.',
        params: TeamIdParamsSchema,
        response: TeamResponses.retrieve,
        security: [{ bearerAuth: [] }],
        summary: 'Retrieve a team',
        tags: ['teams'],
      },
    },
    team.retrieve,
  );
};

export { retrieve };
