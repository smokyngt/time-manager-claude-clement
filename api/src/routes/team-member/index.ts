import rateLimit from '@fastify/rate-limit';

import { Config } from '@/config/index.js';
import { RateLimit } from '@/utils/http/rate-limit.js';

import { add } from './add.js';
import { list } from './list.js';
import { remove } from './remove.js';

import type { FastifyPluginAsync } from 'fastify';

const teamMembers: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    errorResponseBuilder: (req, context) => RateLimit.error(req, context),
    keyGenerator: (req) => RateLimit.key(req),
    max: Config.store.number('TEAM_MEMBER_RATE_LIMIT_MAX', 600),
    timeWindow: Config.store.text('TEAM_MEMBER_RATE_LIMIT_WINDOW', '1 minute'),
  });
  await fastify.register(add);
  await fastify.register(list);
  await fastify.register(remove);
};

export { teamMembers };
