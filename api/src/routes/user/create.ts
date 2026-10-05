import { user } from '@/controllers/user/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { UserCreateBodySchema, UserResponses } from '@/schemas/user.js';

import type { CreateBody, UserResponse } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const create: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateBody; Reply: ReplyEnvelope<UserResponse> }>(
    '/new',
    {
      preHandler: auth({ scopes: ['users:manage'] }),
      schema: {
        body: UserCreateBodySchema,
        description:
          'Registration is manager-only. A manager can only create employees, an admin can create any role.',
        response: UserResponses.create,
        security: [{ bearerAuth: [] }],
        summary: 'Create a user',
        tags: ['users'],
      },
    },
    user.create,
  );
};

export { create };
