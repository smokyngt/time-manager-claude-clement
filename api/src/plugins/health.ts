import { Health } from '@/lib/lifecycle/health.js';

import type { Probe } from '@/lib/lifecycle/health.js';
import type { FastifyPluginAsync } from 'fastify';

export interface HealthOptions {
  probe: Probe;
  timeout?: number;
}

const readyResponse = (status: 'ok' | 'unavailable'): object => ({
  additionalProperties: false,
  properties: {
    checks: {
      additionalProperties: false,
      properties: { database: { enum: [status], type: 'string' } },
      required: ['database'],
      type: 'object',
    },
    status: { enum: [status], type: 'string' },
  },
  required: ['checks', 'status'],
  type: 'object',
});

/**
 * @route plugins.health
 * @param {FastifyInstance} app
 * @param {HealthOptions} options
 * @returns {Promise<void>}
 */
export const health: FastifyPluginAsync<HealthOptions> = async (app, options): Promise<void> => {
  app.get(
    '/health/ready',
    {
      config: { rateLimit: false },
      schema: {
        description: 'Reports whether the service can reach its database within two seconds.',
        response: { 200: readyResponse('ok'), 503: readyResponse('unavailable') },
        summary: 'Readiness probe',
        tags: ['health'],
      },
    },
    async (req, reply) => {
      const up = await Health.check(options.probe, options.timeout ?? 2000);
      if (up) return reply.status(200).send({ checks: { database: 'ok' }, status: 'ok' });
      req.log.warn({ check: 'database' }, 'readiness failed');
      return reply
        .status(503)
        .send({ checks: { database: 'unavailable' }, status: 'unavailable' });
    },
  );
};
