import type { FastifyPluginAsync } from 'fastify';

import { user } from '@/controllers/user/index.js';
import { auth } from '@/plugins/auth.js';
import { UserCreateBodySchema, UserResponses } from '@/schemas/user.js';

import type { CreateBody } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { User } from '@/types/entities/user.js';

export const createRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateBody; Reply: ReplyEnvelope<User> }>(
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
