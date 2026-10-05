import { afterAll, beforeAll, describe, it } from 'bun:test';

import { InternalError } from '@/lib/errors/base/core.js';
import { registerEvent } from '@/lib/events/base/registry.js';
import { auth } from '@/middlewares/auth/index.js';
import {
  ErrorSchema,
  RateLimitErrorSchema,
  ReplyEnvelopeSchema,
  TokenAuthenticationErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from '@/schemas/base/envelope.js';
import { Reply } from '@/utils/http/reply.js';

import { Prehandler } from '../../support/prehandler.js';

import type { PrehandlerRoute } from '../../support/prehandler.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const Done = registerEvent<{ ok: boolean }>({ code: 'thing.done' });

const router: FastifyPluginAsync = (fastify) => {
  fastify.post<{ Reply: ReplyEnvelope<{ ok: boolean }> }>(
    '/write',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        response: {
          200: ReplyEnvelopeSchema(
            {
              additionalProperties: false,
              properties: { ok: { type: 'boolean' } },
              required: ['ok'],
              type: 'object',
            },
            'thing.done',
          ),
          400: ValidationErrorSchema,
          401: TokenAuthenticationErrorSchema,
          403: UnauthorizedErrorSchema,
          429: RateLimitErrorSchema,
          500: ErrorSchema(InternalError),
        },
      },
    },
    async (req, reply) => {
      await Reply.send(req, reply, Done({ payload: { ok: true } }), { ok: true });
    },
  );

  return Promise.resolve();
};

let route: PrehandlerRoute;

beforeAll(async () => {
  Prehandler.install();
  const app = await Prehandler.app(router, '/v1/things');
  route = { app, method: 'POST', url: '/v1/things/write' };
});

afterAll(async () => {
  await route.app.close();
  Prehandler.restore();
});

describe('support.prehandler', () => {
  it('allows the held scope', async () => {
    await Prehandler.allowed(route, 'teams:manage');
  });

  it('denies another scope', async () => {
    await Prehandler.denied(route, 'teams:read');
  });

  it('rejects anonymous callers', async () => {
    await Prehandler.unauthenticated(route);
  });
});
