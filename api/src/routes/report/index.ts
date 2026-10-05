import rateLimit from '@fastify/rate-limit';

import { vaultConfig } from '@/config/vault/index.js';
import { RateLimit } from '@/utils/http/rate-limit.js';

import { team } from './team.js';
import { user } from './user.js';

import type { FastifyPluginAsync } from 'fastify';

const reports: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    errorResponseBuilder: (req, context) => RateLimit.error(req, context),
    keyGenerator: (req) => RateLimit.key(req),
    max: vaultConfig.store.number('REPORT_RATE_LIMIT_MAX', 600),
    timeWindow: vaultConfig.store.text('REPORT_RATE_LIMIT_WINDOW', '1 minute'),
  });
  await fastify.register(team);
  await fastify.register(user);
};

export { reports };
