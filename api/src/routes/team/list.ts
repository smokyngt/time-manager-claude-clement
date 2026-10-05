import { team } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { TeamListBodySchema, TeamResponses } from '@/schemas/index.js';

import type { ListTeamsBody, ListTeamsResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const list: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ListTeamsBody; Reply: ReplyEnvelope<ListTeamsResponse> }>(
    '/list',
    {
      preHandler: auth({ scopes: ['teams:read'] }),
      schema: {
        body: TeamListBodySchema,
        description:
          'Cursor paginated list ordered by creation time. Admins see every team, managers see the teams they manage or belong to, employees see the teams they belong to.',
        response: TeamResponses.list,
        security: [{ bearerAuth: [] }],
        summary: 'List teams',
        tags: ['teams'],
      },
    },
    team.list,
  );
};

export { list };
