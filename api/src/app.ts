import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';

import { Config } from '@/config/index.js';
import { ErrorHandler } from '@/lib/errors/handler.js';
import { authRouter, userRouter } from '@/routes/index.js';

import type { FastifyInstance, FastifyServerOptions } from 'fastify';

/**
 * @route app.build
 * @param {FastifyServerOptions} options
 * @returns {Promise<FastifyInstance>}
 */
export const build = async (options: FastifyServerOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    ajv: { customOptions: { keywords: ['example'], removeAdditional: false } },
    bodyLimit: 1_048_576,
    trustProxy: Config.store.flag('TRUST_PROXY', true),
    ...options,
  });
  app.decorateRequest('actor', null);
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
  await app.register(userRouter, { prefix: '/v1/users' });
  await app.register(authRouter, { prefix: '/v1/auth' });
  return app;
};
