import { user } from '@/controllers/user/index.js';
import { auth } from '@/plugins/auth.js';
import { UserResponses, UserUpdateBodySchema } from '@/schemas/user.js';

import type { UpdateBody, UpdateResponse } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const updateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.patch<{ Body: UpdateBody; Reply: ReplyEnvelope<UpdateResponse> }>(
    '',
    {
      preHandler: auth({ scopes: ['users:write'] }),
      schema: {
        body: UserUpdateBodySchema,
        description:
          'Applies the same data to every id. Authorization is checked for every item before any write. Employees can only change their own names, phone number and password.',
        response: UserResponses.update,
        security: [{ bearerAuth: [] }],
        summary: 'Update users in bulk',
        tags: ['users'],
      },
    },
    user.update,
  );
};
