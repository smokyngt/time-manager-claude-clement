import rateLimit from '@fastify/rate-limit';

import { RateLimit } from '@/utils/rate-limit.js';

import { addRoute } from './add.js';
import { listRoute } from './list.js';
import { removeRoute } from './remove.js';

import type { FastifyPluginAsync } from 'fastify';

export const teamMemberRouter: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, RateLimit.options('team_member'));
  await fastify.register(addRoute);
  await fastify.register(listRoute);
  await fastify.register(removeRoute);
};
