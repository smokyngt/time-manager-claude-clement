import rateLimit from '@fastify/rate-limit';

import { RateLimit } from '@/utils/rate-limit.js';

import { createRoute } from './create.js';
import { currentRoute } from './current.js';
import { deleteRoute } from './delete.js';
import { inRoute } from './in.js';
import { listRoute } from './list.js';
import { outRoute } from './out.js';
import { retrieveRoute } from './retrieve.js';
import { updateRoute } from './update.js';

import type { FastifyPluginAsync } from 'fastify';

export const clockRouter: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, RateLimit.options('clock'));
  await fastify.register(inRoute);
  await fastify.register(outRoute);
  await fastify.register(currentRoute);
  await fastify.register(createRoute);
  await fastify.register(listRoute);
  await fastify.register(retrieveRoute);
  await fastify.register(updateRoute);
  await fastify.register(deleteRoute);
};
