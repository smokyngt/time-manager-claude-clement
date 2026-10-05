import { authController } from '@/controllers/auth/index.js';
import { auth } from '@/plugins/auth.js';
import { AuthResponses } from '@/schemas/auth.js';

import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const meRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ReplyEnvelope<User> }>(
    '/me',
    {
      preHandler: auth({ scopes: ['auth:self'] }),
      schema: {
        description: 'Returns the user owning the access token.',
        response: AuthResponses.me,
        security: [{ bearerAuth: [] }],
        summary: 'Get the current user',
        tags: ['auth'],
      },
    },
    authController.me,
  );
};
