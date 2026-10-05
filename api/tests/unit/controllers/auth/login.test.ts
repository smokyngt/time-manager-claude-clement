import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeReply, makeReq } from '../../../helpers/fixtures.js';
import { makeUser } from '../../../helpers/user-service.js';

import type { LoginBody, SessionResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const real = { ...(await import('@/services/auth/index.js')) };
const user = makeUser('employee', '00000000-0000-4000-8000-0000000000c1');
const session = {
  access_token: 'access',
  expires_in: 900,
  refresh_expires_in: 604_800,
  refresh_token: 'refresh-secret',
  user,
};
const login = mock((_params: LoginBody) => Promise.resolve(session));
await mock.module('@/services/auth/index.js', () => ({
  ...real,
  authService: { login },
}));

afterAll(() => {
  void mock.module('@/services/auth/index.js', () => real);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { login: controller } = await import('@/controllers/auth/login.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>;
type Req = FastifyRequest<{ Body: LoginBody }>;

describe('auth.controller.login', () => {
  it('sets the refresh cookie and never puts the refresh token in the body', async () => {
    const { fake, reply } = makeReply<Rep>();
    await controller(makeReq<Req>({ body: { email: 'a@b.co', password: 'pw' } }), reply);
    expect(fake.cookies['tm_refresh']).toBe('refresh-secret');
    expect(fake.sent).toEqual({
      data: { access_token: 'access', expires_in: 900, token_type: 'Bearer', user },
      event: 'auth.logged_in',
    });
    expect(JSON.stringify(fake.sent)).not.toContain('refresh-secret');
  });

  it('keeps the 401 raised by the service', async () => {
    const { AuthInvalidCredentialsError } = await import('@/lib/errors/domains/auth.js');
    login.mockImplementationOnce(() => Promise.reject(AuthInvalidCredentialsError()));
    const { fake, reply } = makeReply<Rep>();
    const error = await caught(
      controller(makeReq<Req>({ body: { email: 'a@b.co', password: 'pw' } }), reply),
    );
    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(error.status).toBe(401);
    expect(fake.cookies['tm_refresh']).toBeUndefined();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    login.mockImplementationOnce(() => Promise.reject(failure));
    const { reply } = makeReply<Rep>();
    const error = await caught(
      controller(makeReq<Req>({ body: { email: 'a@b.co', password: 'pw' } }), reply),
    );
    expect(error.code).toBe('AUTH_LOGIN_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.controller.login');
  });
});
