import rateLimit from '@fastify/rate-limit';

import { vaultConfig } from '@/config/vault/index.js';
import { RateLimit } from '@/utils/http/rate-limit.js';

import { archive } from './archive.js';
import { create } from './create.js';
import { deleteRoute } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { FastifyPluginAsync } from 'fastify';

const teams: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    errorResponseBuilder: (req, context) => RateLimit.error(req, context),
    keyGenerator: (req) => RateLimit.key(req),
    max: vaultConfig.store.number('TEAM_RATE_LIMIT_MAX', 600),
    timeWindow: vaultConfig.store.text('TEAM_RATE_LIMIT_WINDOW', '1 minute'),
  });
  await fastify.register(create);
  await fastify.register(list);
  await fastify.register(update);
  await fastify.register(deleteRoute);
  await fastify.register(retrieve);
  await fastify.register(archive);
  await fastify.register(restore);
};

export { teams };
