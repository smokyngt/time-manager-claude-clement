import fp from 'fastify-plugin';

import type { FastifyPluginAsync } from 'fastify';

/**
 * @route plugins.observability
 * @param {FastifyInstance} app
 * @returns {Promise<void>}
 */
export const observability: FastifyPluginAsync = fp(
  async (app): Promise<void> => {
    app.addHook('onSend', async (req, reply) => {
      reply.header('x-request-id', req.id);
    });
  },
  { name: 'observability' },
);
