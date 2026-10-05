import { user } from '@/controllers/user/index.js';
import { auth } from '@/plugins/auth.js';
import { UserIdParamsSchema, UserResponses } from '@/schemas/user.js';

import type { ArchiveParams } from '@/controllers/user/index.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const archiveRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: ArchiveParams; Reply: ReplyEnvelope<User> }>(
    '/:id/archive',
    {
      preHandler: auth({ scopes: ['users:manage'] }),
      schema: {
        description: 'Archive a user. Archived users cannot sign in.',
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
