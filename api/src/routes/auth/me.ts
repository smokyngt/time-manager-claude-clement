import { authController } from '@/controllers/auth/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { AuthResponses } from '@/schemas/auth.js';

import type { MeResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const me: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ReplyEnvelope<MeResponse> }>(
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
