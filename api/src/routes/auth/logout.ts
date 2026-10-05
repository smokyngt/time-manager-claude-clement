import { authController } from '@/controllers/auth/index.js';
import { AuthResponses } from '@/schemas/auth.js';

import type { LogoutResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const logoutRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Reply: ReplyEnvelope<LogoutResponse> }>(
    '/logout',
    {
      schema: {
        description:
          'Authenticated by the tm_refresh cookie only, no access token needed. Revokes the refresh token family of the cookie, clears it and always answers 200, even without a valid cookie.',
        response: AuthResponses.logout,
        summary: 'Sign out',
        tags: ['auth'],
      },
    },
    authController.logout,
  );
};
