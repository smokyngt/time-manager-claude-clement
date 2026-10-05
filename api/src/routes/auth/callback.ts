import { authController } from '@/controllers/auth/index.js';
import { AuthCallbackQuerySchema, AuthResponses } from '@/schemas/auth.js';

import type { CallbackQuery } from '@/controllers/auth/index.js';
import type { FastifyPluginAsync } from 'fastify';

const callback: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: CallbackQuery }>(
    '/microsoft/callback',
    {
      schema: {
        description:
          'Exchanges the code, links the Microsoft identity to an existing user, sets the tm_refresh cookie and redirects to the web application. Unknown users are never created.',
        querystring: AuthCallbackQuerySchema,
        response: AuthResponses.callback,
        summary: 'Microsoft OAuth2 callback',
        tags: ['auth'],
      },
    },
    authController.callback,
  );
};

export { callback };
