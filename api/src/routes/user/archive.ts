import { user } from '@/controllers/user/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { UserIdParamsSchema, UserResponses } from '@/schemas/user.js';

import type { ArchiveParams, UserResponse } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const archive: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: ArchiveParams; Reply: ReplyEnvelope<UserResponse> }>(
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
    user.archive,
  );
};

export { archive };
