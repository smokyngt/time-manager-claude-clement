import fp from 'fastify-plugin';

import { NotFoundError, TokenAuthenticationError } from '@/lib/errors/index.js';
import { Metrics } from '@/lib/telemetry/metrics.js';

export type MetricsOptions = {
  production: boolean;
  token?: string;
};

/**
 * @route plugins.metrics
 * @param {FastifyInstance} app
 * @param {MetricsOptions} options
 * @param {() => void} done
 * @returns {void}
 * @throws {NotFoundError | TokenAuthenticationError}
 */
export const metrics = fp<MetricsOptions>(
  (app, options, done): void => {
    app.get(
      '/metrics',
      { config: { rateLimit: false }, schema: { hide: true } },
      async (req, reply) => {
        const gate = Metrics.gate({
          header: req.headers.authorization,
          production: options.production,
          token: options.token,
        });
        if (gate === 'hide') throw NotFoundError({ metadata: { route: 'plugins.metrics' } });
        if (gate === 'deny') throw TokenAuthenticationError({ metadata: { route: 'plugins.metrics' } });
        const scrape = await Metrics.scrape(req.headers.accept);

        return reply.type(scrape.type).send(scrape.body);
      },
    );
    done();
  },
  { name: 'metrics' },
);
