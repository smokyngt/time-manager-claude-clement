import rateLimit from '@fastify/rate-limit';

import { RateLimit } from '@/utils/rate-limit.js';

import { archiveRoute } from './archive.js';
import { createRoute } from './create.js';
import { deleteRoute } from './delete.js';
import { listRoute } from './list.js';
import { restoreRoute } from './restore.js';
import { retrieveRoute } from './retrieve.js';
import { updateRoute } from './update.js';

import type { FastifyPluginAsync } from 'fastify';

export const teamRouter: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, RateLimit.options('team'));
  await fastify.register(createRoute);
  await fastify.register(listRoute);
  await fastify.register(updateRoute);
  await fastify.register(deleteRoute);
  await fastify.register(retrieveRoute);
  await fastify.register(archiveRoute);
  await fastify.register(restoreRoute);
};
