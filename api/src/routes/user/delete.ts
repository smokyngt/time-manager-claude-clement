import { user } from '@/controllers/user/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { UserDeleteBodySchema, UserResponses } from '@/schemas/user.js';

import type { DeleteBody, DeleteResponse } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const deleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.delete<{ Body: DeleteBody; Reply: ReplyEnvelope<DeleteResponse> }>(
    '',
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

export { deleteRoute };
