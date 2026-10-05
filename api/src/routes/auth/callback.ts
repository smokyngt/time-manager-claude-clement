import { authController } from '@/controllers/index.js';
import { AuthCallbackQuerySchema, AuthResponses } from '@/schemas/index.js';

import type { AuthCallbackQuery } from '@/controllers/index.js';
import type { FastifyPluginAsync } from 'fastify';

const callback: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: AuthCallbackQuery }>(
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
