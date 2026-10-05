import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { AuthLoggedIn, AuthLoggedOut, AuthRefreshed, AuthRetrieved } from '@/lib/events/domains/auth.js';
import { Reply } from '@/utils/http/reply.js';

import { Prehandler } from '../../../support/prehandler.js';
import { OTHER_ID, userOf } from '../../services/user/support.js';

import type { PrehandlerRoute } from '../../../support/prehandler.js';
import type { AppEvent } from '@/lib/events/base/registry.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const realControllers = { ...(await import('@/controllers/auth/index.js')) };
const saved = { ...process.env };

const user = userOf('employee', OTHER_ID);
const session = {
  access_token: 'access',
  expires_in: 900,
  scopes: ['auth:self'],
  token_type: 'Bearer',
  user,
};

const answer =
  <Data, Payload>(event: AppEvent<Payload>, data: Data) =>
  (req: FastifyRequest, reply: FastifyReply<{ Reply: ReplyEnvelope<Data> }>): Promise<void> =>
    Reply.send(req, reply, event, data);

await mock.module('@/controllers/auth/index.js', () => ({
  ...realControllers,
  authController: {
    callback: (_req: FastifyRequest, reply: FastifyReply) => reply.redirect('http://localhost:5173/auth/callback'),
    login: answer(AuthLoggedIn({ payload: { actor: OTHER_ID } }), session),
    logout: answer(AuthLoggedOut({ payload: {} }), { success: true }),
    me: answer(AuthRetrieved({ payload: { actor: OTHER_ID } }), { scopes: ['auth:self'], user }),
    microsoft: (_req: FastifyRequest, reply: FastifyReply) => reply.redirect('https://login.example/auth'),
    refresh: answer(AuthRefreshed({ payload: { actor: OTHER_ID } }), session),
  },
}));

process.env['AUTH_LOGIN_RATE_LIMIT_MAX'] = '3';
const { auth } = await import('@/routes/auth/index.js');

const BASE = '/v1/auth';
let app: FastifyInstance;

beforeAll(async () => {
  Prehandler.install();
  app = await Prehandler.app(auth, BASE);
});

afterAll(async () => {
  await app.close();
  Prehandler.restore();
  process.env = saved;
  void mock.module('@/controllers/auth/index.js', () => realControllers);
});

const me = (): PrehandlerRoute => ({ app, method: 'GET', url: `${BASE}/me` });

describe('routes.auth.me', () => {
  it('allows auth:self and serializes user and scopes', async () => {
    await Prehandler.allowed(me(), 'auth:self');
  });

  it('denies a foreign scope', async () => {
    await Prehandler.denied(me(), 'teams:manage');
  });

  it('rejects anonymous callers', async () => {
    await Prehandler.unauthenticated(me());
  });
});

describe('routes.auth public routes', () => {
  it('login validates the body, strips unknown fields and serializes the named session', async () => {
    const invalid = await app.inject({
      method: 'POST',
      payload: { email: 'not-an-email', password: 'x' },
      url: `${BASE}/login`,
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json<{ code: string }>().code).toBe('validation.error');
    const ok = await app.inject({
      method: 'POST',
      payload: { email: 'jane.doe@example.com', extra: 1, password: 'x' },
      url: `${BASE}/login`,
    });
    expect(ok.statusCode).toBe(200);
    const body = ok.json<{ data: Record<string, unknown>; event: { code: string } }>();
    expect(body.event.code).toBe('auth.logged_in');
    expect(body.data).toMatchObject({ scopes: ['auth:self'], token_type: 'Bearer' });
    expect(body.data['user']).not.toHaveProperty('email_hash');
  });

  it('refresh and logout need no bearer token', async () => {
    const refresh = await app.inject({ method: 'POST', url: `${BASE}/refresh` });
    const logout = await app.inject({ method: 'POST', url: `${BASE}/logout` });
    expect(refresh.statusCode).toBe(200);
    expect(logout.statusCode).toBe(200);
    expect(logout.json<{ data: unknown }>().data).toEqual({ success: true });
  });

  it('microsoft routes redirect without authentication', async () => {
    const start = await app.inject({ method: 'GET', url: `${BASE}/microsoft` });
    const done = await app.inject({
      method: 'GET',
      url: `${BASE}/microsoft/callback?code=c&state=s&extra=1`,
    });
    expect(start.statusCode).toBe(302);
    expect(done.statusCode).toBe(302);
  });

  it('limits login per ip with rate.limit.exceeded and a Retry-After header', async () => {
    const attempt = () =>
      app.inject({
        method: 'POST',
        payload: { email: 'jane.doe@example.com', password: 'x' },
        remoteAddress: '10.9.9.9',
        url: `${BASE}/login`,
      });
    const statuses: number[] = [];
    let last = await attempt();
    statuses.push(last.statusCode);
    for (let count = 0; count < 3; count += 1) {
      last = await attempt();
      statuses.push(last.statusCode);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(last.json<{ code: string }>().code).toBe('rate.limit.exceeded');
    expect(last.headers['retry-after']).toBeDefined();
  });
});
