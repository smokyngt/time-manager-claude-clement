import rateLimit from '@fastify/rate-limit';

import { Config } from '@/config/index.js';
import { RateLimit } from '@/utils/http/rate-limit.js';

import { callback } from './callback.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { me } from './me.js';
import { microsoft } from './microsoft.js';
import { refresh } from './refresh.js';

import type { FastifyPluginAsync } from 'fastify';

const auth: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    errorResponseBuilder: (req, context) => RateLimit.error(req, context),
    keyGenerator: (req) => RateLimit.key(req),
    max: Config.store.number('AUTH_RATE_LIMIT_MAX', 100),
    timeWindow: Config.store.text('AUTH_RATE_LIMIT_WINDOW', '1 minute'),
  });
  await fastify.register(login);
  await fastify.register(refresh);
  await fastify.register(logout);
  await fastify.register(me);
  await fastify.register(microsoft);
  await fastify.register(callback);
};

export { auth };
