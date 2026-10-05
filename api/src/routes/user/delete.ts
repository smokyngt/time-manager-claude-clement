import type { FastifyPluginAsync } from 'fastify';

import { user } from '@/controllers/user/index.js';
import { auth } from '@/plugins/auth.js';
import { UserDeleteBodySchema, UserResponses } from '@/schemas/user.js';

import type { DeleteBody, DeleteResponse } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';

export const deleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.delete<{ Body: DeleteBody; Reply: ReplyEnvelope<DeleteResponse> }>(
    '/',
    {
      preHandler: auth({ scopes: ['users:manage'] }),
      schema: {
        body: UserDeleteBodySchema,
        description:
          'Permanently deletes users. Authorization is checked for every item before any deletion. Nobody can delete themselves.',
        response: UserResponses.delete,
        security: [{ bearerAuth: [] }],
        summary: 'Delete users in bulk',
        tags: ['users'],
      },
    },
    user.delete,
  );
};
