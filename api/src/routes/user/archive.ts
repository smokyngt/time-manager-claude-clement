import { userController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { UserIdParamsSchema, UserResponses } from '@/schemas/index.js';

import type { ArchiveUserParams, UserResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const archive: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: ArchiveUserParams; Reply: ReplyEnvelope<UserResponse> }>(
    '/:id/archive',
    {
      preHandler: auth({ scopes: ['users:manage'] }),
      schema: {
        description:
          'Archive a user. Archived users cannot sign in.',
        params: UserIdParamsSchema,
        response: UserResponses.archive,
        security: [{ bearerAuth: [] }],
        summary: 'Archive a user',
        tags: ['users'],
      },
    },
    userController.archive,
  );
};

export { archive };
