import { authController } from '@/controllers/index.js';
import { AuthResponses } from '@/schemas/index.js';

import type { FastifyPluginAsync } from 'fastify';

const microsoft: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/microsoft',
    {
      schema: {
        description:
          'Starts the OAuth2 authorization code flow with PKCE. Returns 503 when Microsoft sign-in is not configured.',
        response: AuthResponses.microsoft,
        summary: 'Sign in with Microsoft',
        tags: ['auth'],
      },
    },
    authController.microsoft,
  );
};

export { microsoft };
