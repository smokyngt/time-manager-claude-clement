import { userController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { UserDeleteBodySchema, UserResponses } from '@/schemas/index.js';

import type { DeleteUsersBody, DeleteUsersResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const deleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.delete<{ Body: DeleteUsersBody; Reply: ReplyEnvelope<DeleteUsersResponse> }>(
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
    userController.delete,
  );
};

export { deleteRoute };
