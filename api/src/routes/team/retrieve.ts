import { team } from '@/controllers/team/index.js';
import { auth } from '@/plugins/auth.js';
import { TeamIdParamsSchema, TeamResponses } from '@/schemas/team.js';

import type { RetrieveParams } from '@/controllers/team/index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const retrieveRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: RetrieveParams; Reply: ReplyEnvelope<Team> }>(
    '/:id',
    {
      preHandler: auth({ scopes: ['teams:read'] }),
      schema: {
        description:
          'Admins can read any team. Managers and employees can read the teams they manage or belong to.',
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
