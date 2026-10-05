import type { FastifyPluginAsync } from 'fastify';

import { user } from '@/controllers/user/index.js';
import { auth } from '@/plugins/auth.js';
import { UserIdParamsSchema, UserResponses } from '@/schemas/user.js';

import type { RestoreParams } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { User } from '@/types/entities/user.js';

export const restoreRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: RestoreParams; Reply: ReplyEnvelope<User> }>(
    '/:id/restore',
    {
      preHandler: auth({ scopes: ['users:manage'] }),
      schema: {
        description: 'Restore a user. Archived users cannot sign in.',
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
