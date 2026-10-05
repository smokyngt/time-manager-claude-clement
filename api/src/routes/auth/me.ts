import { authController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { AuthResponses } from '@/schemas/index.js';

import type { AuthMeResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const me: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ReplyEnvelope<AuthMeResponse> }>(
    '/me',
    {
      preHandler: auth({ scopes: ['auth:self'] }),
      schema: {
        description: 'Returns the user owning the access token and the scopes of their role.',
        response: AuthResponses.me,
        security: [{ bearerAuth: [] }],
        summary: 'Get the current user',
        tags: ['auth'],
      },
    },
    authController.me,
  );
};

export { me };
