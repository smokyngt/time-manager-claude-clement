import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { fastifyRequestContext } from '@fastify/request-context';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { trace } from '@opentelemetry/api';
import Fastify from 'fastify';

import { Config } from '@/config/index.js';
import { Redact } from '@/lib/auth/redact.js';
import { ValidationError } from '@/lib/errors/base/core.js';
import { ErrorHandler } from '@/middlewares/error.js';
import { Sanitizer } from '@/utils/http/sanitizer.js';

import type { FastifyInstance, FastifyServerOptions } from 'fastify';

const REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;
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
    genReqId: (req) => {
      const header = req.headers['x-request-id'];

      return typeof header === 'string' && REQUEST_ID.test(header) ? header : crypto.randomUUID();
    },
    requestIdHeader: false,
    trustProxy: Config.store.flag('TRUST_PROXY', true),
    ...options,
  });
  await app.register(fastifyRequestContext);
  app.addHook('onRequest', (req, reply, next) => {
    void reply.header('x-request-id', req.id);
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
        { description: 'Liveness probe.', name: 'health' },
        { description: 'Aggregated working time reports.', name: 'reports' },
        { description: 'Team membership.', name: 'team-members' },
        { description: 'Teams.', name: 'teams' },
        { description: 'User accounts.', name: 'users' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            additionalProperties: false,
            properties: { status: { enum: ['ok'], type: 'string' } },
            required: ['status'],
            type: 'object',
          },
        },
        summary: 'Liveness probe',
        tags: ['health'],
      },
    },
    () => ({ status: 'ok' as const }),
  );

  return app;
};
