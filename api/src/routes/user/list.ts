import { user } from '@/controllers/user/index.js';
import { auth } from '@/plugins/auth.js';
import { UserListBodySchema, UserResponses } from '@/schemas/user.js';

import type { ListBody, ListResponse } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const listRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ListBody; Reply: ReplyEnvelope<ListResponse> }>(
    '/list',
    {
      preHandler: auth({ scopes: ['users:manage'] }),
      schema: {
        body: UserListBodySchema,
        description:
          'Cursor paginated list ordered by creation time. Managers only see employees they manage or employees without a team.',
        response: UserResponses.list,
        security: [{ bearerAuth: [] }],
        summary: 'List users',
        tags: ['users'],
      },
    },
    user.list,
  );
};
