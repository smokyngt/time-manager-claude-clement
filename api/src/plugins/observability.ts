import fp from 'fastify-plugin';

/**
 * @route plugins.observability
 * @param {FastifyInstance} app
 * @param {object} _options
 * @param {() => void} done
 * @returns {void}
 */
export const observability = fp(
  (app, _options, done): void => {
    app.addHook('onSend', (req, reply, payload, next) => {
      reply.header('x-request-id', req.id);
      next(null, payload);
    });
    done();
  },
  { name: 'observability' },
);
