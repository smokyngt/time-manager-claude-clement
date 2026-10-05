import fp from 'fastify-plugin';
import { collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';

import { NotFoundError, UnauthorizedError } from '@/lib/errors/index.js';
import { Metrics } from '@/lib/telemetry/metrics.js';


export interface MetricsOptions {
  poolMax?: number;
  production: boolean;
  token?: string;
}

/**
 * @route plugins.metrics
 * @param {FastifyInstance} app
 * @param {MetricsOptions} options
 * @param {() => void} done
 * @returns {void}
 * @throws {NotFoundError | UnauthorizedError}
 */
export const metrics = fp<MetricsOptions>(
  (app, options, done): void => {
    const register = new Registry();
    collectDefaultMetrics({ register });
    const duration = new Histogram({
      buckets: [...Metrics.buckets],
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status_code'],
      name: 'http_request_duration_seconds',
      registers: [register],
    });
    if (options.poolMax !== undefined) {
      const pool = new Gauge({
        help: 'Configured maximum size of the database connection pool.',
        name: 'db_pool_max_connections',
        registers: [register],
      });
      pool.set(options.poolMax);
    }
    app.addHook('onResponse', (req, reply, next) => {
      const route = Metrics.route(req.routeOptions.url);
      if (route !== '/metrics') {
        duration
          .labels(req.method, route, String(reply.statusCode))
          .observe(reply.elapsedTime / 1000);
      }
      next();
    });
    app.get(
      '/metrics',
      {
        config: { rateLimit: false },
        schema: {
          description: 'Prometheus exposition format. Requires the metrics bearer token when set.',
          response: { 200: { type: 'string' } },
          security: [{ bearerAuth: [] }],
          summary: 'Prometheus metrics',
          tags: ['metrics'],
        },
      },
      async (req, reply) => {
        const gate = Metrics.gate({
          header: req.headers.authorization,
          production: options.production,
          token: options.token,
        });
        if (gate === 'hide') throw NotFoundError({ metadata: { route: 'plugins.metrics' } });
        if (gate === 'deny') throw UnauthorizedError({ metadata: { route: 'plugins.metrics' } });
        return reply.type(register.contentType).send(await register.metrics());
      },
    );
    done();
  },
  { name: 'metrics' },
);
