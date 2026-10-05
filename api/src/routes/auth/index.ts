import rateLimit from '@fastify/rate-limit';

import { RateLimit } from '@/utils/rate-limit.js';

import { loginRoute } from './login.js';
import { logoutRoute } from './logout.js';
import { meRoute } from './me.js';
import { microsoftRoute } from './microsoft.js';
import { refreshRoute } from './refresh.js';

import type { FastifyPluginAsync } from 'fastify';

export const authRouter: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, RateLimit.options('auth'));
  await fastify.register(loginRoute);
  await fastify.register(refreshRoute);
  await fastify.register(logoutRoute);
  await fastify.register(meRoute);
  await fastify.register(microsoftRoute);
};
