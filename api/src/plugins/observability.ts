import fp from 'fastify-plugin';

import { Metrics } from '@/lib/telemetry/metrics.js';

import type { FastifyRequest } from 'fastify';

type Mark = { start: number; trace: string | undefined };

/**
 * @route plugins.observability
 * @param {FastifyInstance} app
 * @param {object} _options
 * @param {() => void} done
 * @returns {void}
 */
export const observability = fp(
  (app, _options, done): void => {
    const marks = new WeakMap<FastifyRequest, Mark>();
    app.addHook('onRequest', (req, _reply, next) => {
      marks.set(req, { start: performance.now(), trace: Metrics.trace() });
      next();
    });
    app.addHook('onSend', (req, reply, payload, next) => {
      reply.header('x-request-id', req.id);
      next(null, payload);
    });
    app.addHook('onResponse', (req, reply, next) => {
      const mark = marks.get(req);
      const route = Metrics.route(req.routeOptions.url);
      if (mark !== undefined && route !== '/metrics') {
        Metrics.observe({
          method: req.method,
          route,
          seconds: (performance.now() - mark.start) / 1000,
          status: reply.statusCode,
          trace: mark.trace,
        });
      }
      next();
    });
    done();
  },
  { name: 'observability' },
);
