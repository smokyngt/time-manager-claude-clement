import { Config } from '@/config/index.js';
import { authController } from '@/controllers/auth/index.js';
import { AuthLoginBodySchema, AuthResponses } from '@/schemas/auth.js';

import type { LoginBody, SessionResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const login: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: LoginBody; Reply: ReplyEnvelope<SessionResponse> }>(
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
