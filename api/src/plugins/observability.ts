import fp from 'fastify-plugin';


/**
 * @route plugins.observability
 * @param {FastifyInstance} app
 * @returns {Promise<void>}
 */
export const observability = fp(
  async (app): Promise<void> => {
    app.addHook('onSend', async (req, reply) => {
      reply.header('x-request-id', req.id);
    });
  },
  { name: 'observability' },
);
