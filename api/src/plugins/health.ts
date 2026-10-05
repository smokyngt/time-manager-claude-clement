import { Health } from '@/lib/lifecycle/health.js';

import type { Probe } from '@/lib/lifecycle/health.js';
import type { FastifyPluginCallback } from 'fastify';

export type HealthOptions = {
  probe: Probe;
  timeout?: number;
};

const liveResponse = {
  additionalProperties: false,
  description: 'The process is alive.',
  properties: {
    status: { description: 'Liveness state.', enum: ['ok'], example: 'ok', type: 'string' },
  },
  required: ['status'],
  type: 'object',
};

const readyResponse = (status: 'ok' | 'unavailable', description: string): object => ({
  additionalProperties: false,
  description,
  properties: {
    checks: {
      additionalProperties: false,
      description: 'State of each dependency.',
      properties: {
        database: {
          description: 'Database state.',
          enum: [status],
          example: status,
          type: 'string',
        },
      },
      required: ['database'],
      type: 'object',
    },
    status: { description: 'Overall readiness.', enum: [status], example: status, type: 'string' },
  },
  required: ['checks', 'status'],
  type: 'object',
});

/**
 * @route plugins.health
 * @param {FastifyInstance} app
 * @param {HealthOptions} options
 * @param {() => void} done
 * @returns {void}
 */
export const health: FastifyPluginCallback<HealthOptions> = (app, options, done): void => {
  app.get(
    '/health',
    {
      config: { rateLimit: false },
      logLevel: 'warn',
      schema: {
        description: 'Reports that the process is running. Does not touch dependencies.',
        response: { 200: liveResponse },
        summary: 'Liveness probe',
        tags: ['health'],
      },
    },
    () => ({ status: 'ok' as const }),
  );
  app.get(
    '/health/ready',
    {
      config: { rateLimit: false },
      logLevel: 'warn',
      schema: {
        description: 'Reports whether the service can reach its database within two seconds.',
        response: {
          200: readyResponse('ok', 'The service is ready.'),
          503: readyResponse('unavailable', 'A dependency is unavailable.'),
        },
        summary: 'Readiness probe',
        tags: ['health'],
      },
    },
    async (req, reply) => {
      const up = await Health.check(options.probe, options.timeout ?? 2000);
      if (up) return reply.status(200).send({ checks: { database: 'ok' }, status: 'ok' });
      req.log.warn({ check: 'database' }, 'readiness failed');

      return reply.status(503).send({ checks: { database: 'unavailable' }, status: 'unavailable' });
    },
  );
  done();
};
