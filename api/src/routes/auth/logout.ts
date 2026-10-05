import { authController } from '@/controllers/auth/index.js';
import { auth } from '@/plugins/auth.js';
import { AuthResponses } from '@/schemas/auth.js';

import type { LogoutResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const logoutRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Reply: ReplyEnvelope<LogoutResponse> }>(
    '/logout',
    {
      preHandler: auth({ scopes: ['auth:self'] }),
      schema: {
        description: 'Revokes the refresh token family of the current cookie and clears it.',
        response: AuthResponses.logout,
        security: [{ bearerAuth: [] }],
        summary: 'Sign out',
        tags: ['auth'],
      },
    },
    authController.logout,
  );
};
