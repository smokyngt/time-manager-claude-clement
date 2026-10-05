import { authController } from '@/controllers/auth/index.js';
import { AuthCallbackQuerySchema, AuthResponses } from '@/schemas/auth.js';

import type { CallbackQuery } from '@/controllers/auth/index.js';
import type { FastifyPluginAsync } from 'fastify';

export const microsoftRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/microsoft',
    {
      schema: {
        description:
          'Starts the OAuth2 authorization code flow with PKCE. Returns 503 when MICROSOFT_CLIENT_ID is not configured.',
        response: AuthResponses.microsoft,
        summary: 'Sign in with Microsoft',
        tags: ['auth'],
      },
    },
    authController.microsoft,
  );
  fastify.get<{ Querystring: CallbackQuery }>(
    '/microsoft/callback',
    {
      schema: {
        description:
          'Exchanges the code, links the Microsoft identity to an existing user, sets the tm_refresh cookie and redirects to WEB_URL/auth/callback. Unknown users are never created.',
        querystring: AuthCallbackQuerySchema,
        response: AuthResponses.callback,
        summary: 'Microsoft OAuth2 callback',
        tags: ['auth'],
      },
    },
    authController.callback,
  );
};
