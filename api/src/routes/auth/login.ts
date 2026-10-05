import { Config } from '@/config/index.js';
import { authController } from '@/controllers/index.js';
import { AuthLoginBodySchema, AuthResponses } from '@/schemas/index.js';

import type { AuthLoginBody, AuthSessionResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const login: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: AuthLoginBody; Reply: ReplyEnvelope<AuthSessionResponse> }>(
    '/login',
    {
      config: {
        rateLimit: {
          max: Config.store.number('AUTH_LOGIN_RATE_LIMIT_MAX', 10),
          timeWindow: Config.store.text('AUTH_LOGIN_RATE_LIMIT_WINDOW', '1 minute'),
        },
      },
      schema: {
        body: AuthLoginBodySchema,
        description:
          'Returns an access token in the body and sets the httpOnly tm_refresh cookie scoped to /v1/auth. Limited per IP and per account.',
        response: AuthResponses.login,
        summary: 'Sign in with email and password',
        tags: ['auth'],
      },
    },
    authController.login,
  );
};

export { login };
