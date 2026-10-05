import rateLimit from '@fastify/rate-limit';

import { Config } from '@/config/index.js';
import { RateLimit } from '@/utils/http/rate-limit.js';

import { create } from './create.js';
import { current } from './current.js';
import { deleteRoute } from './delete.js';
import { clockIn } from './in.js';
import { list } from './list.js';
import { clockOut } from './out.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { FastifyPluginAsync } from 'fastify';

const clocks: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    errorResponseBuilder: (req, context) => RateLimit.error(req, context),
    keyGenerator: (req) => RateLimit.key(req),
    max: Config.store.number('CLOCK_RATE_LIMIT_MAX', 6000),
    timeWindow: Config.store.text('CLOCK_RATE_LIMIT_WINDOW', '1 minute'),
  });
  await fastify.register(clockIn);
  await fastify.register(clockOut);
  await fastify.register(current);
  await fastify.register(create);
  await fastify.register(list);
  await fastify.register(update);
  await fastify.register(deleteRoute);
  await fastify.register(retrieve);
};

export { clocks };
