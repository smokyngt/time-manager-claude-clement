import { team } from '@/controllers/team/index.js';
import { auth } from '@/plugins/auth.js';
import { TeamListBodySchema, TeamResponses } from '@/schemas/team.js';

import type { ListBody, ListResponse } from '@/controllers/team/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const listRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ListBody; Reply: ReplyEnvelope<ListResponse> }>(
    '/list',
    {
      preHandler: auth({ scopes: ['teams:read'] }),
      schema: {
        body: TeamListBodySchema,
        description:
          'Cursor paginated list ordered by creation time. Admins see every team, managers the teams they manage or belong to, employees the teams they belong to.',
        response: TeamResponses.list,
        security: [{ bearerAuth: [] }],
        summary: 'List teams',
        tags: ['teams'],
      },
    },
    team.list,
  );
};
