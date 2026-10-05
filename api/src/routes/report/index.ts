import rateLimit from '@fastify/rate-limit';

import { RateLimit } from '@/utils/rate-limit.js';

import { teamRoute } from './team.js';
import { userRoute } from './user.js';

import type { FastifyPluginAsync } from 'fastify';

export const reportRouter: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, RateLimit.options('report'));
  await fastify.register(teamRoute);
  await fastify.register(userRoute);
};
