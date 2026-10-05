import { authController } from '@/controllers/auth/index.js';
import { AuthResponses } from '@/schemas/auth.js';

import type { SessionResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const refresh: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Reply: ReplyEnvelope<SessionResponse> }>(
    '/refresh',
    {
      schema: {
        description:
          'Reads the tm_refresh cookie, rotates it and returns a new access token. A token rotated less than 10 seconds ago is accepted once more; later reuse revokes the whole session family.',
        response: AuthResponses.refresh,
        summary: 'Rotate the refresh token and get a new access token',
        tags: ['auth'],
      },
    },
    authController.refresh,
  );
};

export { refresh };
