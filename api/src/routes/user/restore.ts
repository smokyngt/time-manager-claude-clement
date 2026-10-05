import { user } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { UserIdParamsSchema, UserResponses } from '@/schemas/index.js';

import type { RestoreUserParams, UserResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const restore: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: RestoreUserParams; Reply: ReplyEnvelope<UserResponse> }>(
    '/:id/restore',
    {
      preHandler: auth({ scopes: ['users:manage'] }),
      schema: {
        description:
          'Restore an archived user so they can sign in again.',
        params: UserIdParamsSchema,
        response: UserResponses.restore,
        security: [{ bearerAuth: [] }],
        summary: 'Restore a user',
        tags: ['users'],
      },
    },
    user.restore,
  );
};

export { restore };
