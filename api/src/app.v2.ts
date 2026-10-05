import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { fastifyRequestContext } from '@fastify/request-context';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { trace } from '@opentelemetry/api';
import Fastify from 'fastify';

import { Config } from '@/config/index.js';
import { sql } from '@/db/client.js';
import { Redact } from '@/lib/auth/redact.js';
import { ValidationError } from '@/lib/errors/base/core.js';
import { Telemetry } from '@/lib/telemetry/index.js';
import { ErrorHandler } from '@/middlewares/error.js';
import { health } from '@/plugins/health.js';
import { metrics } from '@/plugins/metrics.js';
import { observability } from '@/plugins/observability.js';
import { Sanitizer } from '@/utils/http/sanitizer.js';

import type { FastifyInstance, FastifyServerOptions } from 'fastify';

const BODY_LIMIT = 1_048_576;

/**
 * @route app.v2.build
 * @param {FastifyServerOptions} options
 * @returns {Promise<FastifyInstance>}
 * @throws {ValidationError}
 */
export const build = async (options: FastifyServerOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    ajv: {
      customOptions: {
        allErrors: true,
        coerceTypes: true,
        keywords: ['example'],
        removeAdditional: true,
      },
    },
    bodyLimit: BODY_LIMIT,
    genReqId: (req) => Telemetry.id(req),
    logger: Telemetry.logger(),
    requestIdHeader: false,
    trustProxy: Config.store.flag('TRUST_PROXY', true),
    ...options,
  });
  await app.register(fastifyRequestContext);
  await app.register(observability);
  await app.register(metrics, {
    production: Config.production(),
    token: Config.store.optional('METRICS_TOKEN'),
  });
  await app.register(health, { probe: async () => sql`select 1` });
  app.addHook('onRequest', (req, _reply, next) => {
    const log = req.log.child({
      ip: req.ip,
      method: req.method,
      request_id: req.id,
      trace_id: trace.getActiveSpan()?.spanContext().traceId,
      url: Redact.url(req.url),
    });
    req.requestContext.set('log', log);
    next();
  });
  app.addHook('preValidation', (req, _reply, next) => {
    const maxDepth = Config.store.number('JSON_BODY_MAX_DEPTH', 10);
    if (typeof req.body === 'object' && req.body !== null) {
      if (Sanitizer.depth(req.body) > maxDepth) {
        next(ValidationError({ metadata: { max_depth: maxDepth, route: 'app.preValidation' } }));

        return;
      }
      req.body = Sanitizer.body(req.body);
    }
    next();
  });
  app.setErrorHandler((error, req, reply) => ErrorHandler.handle(error, req, reply));
  app.setNotFoundHandler((req, reply) => ErrorHandler.missing(req, reply));
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    credentials: true,
    methods: ['DELETE', 'GET', 'PATCH', 'POST', 'OPTIONS'],
    origin: Config.store.text('CORS_ORIGIN', 'http://localhost:5173').split(','),
  });
  await app.register(cookie);
  await app.register(swagger, {
    openapi: {
      components: {
        securitySchemes: { bearerAuth: { bearerFormat: 'JWT', scheme: 'bearer', type: 'http' } },
      },
      info: {
        description: 'Time Manager API. Employees clock in and out, managers manage teams.',
        title: 'Time Manager API',
        version: '0.1.0',
      },
      openapi: '3.0.3',
      tags: [
        { description: 'Sign in, sessions and Microsoft SSO.', name: 'auth' },
        { description: 'Clock entries.', name: 'clocks' },
        { description: 'Liveness and readiness probes.', name: 'health' },
        { description: 'Aggregated working time reports.', name: 'reports' },
        { description: 'Team membership.', name: 'team-members' },
        { description: 'Teams.', name: 'teams' },
        { description: 'User accounts.', name: 'users' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  return app;
};
