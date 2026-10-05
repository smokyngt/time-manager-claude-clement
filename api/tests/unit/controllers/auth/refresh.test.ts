import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeReply, makeReq } from '../../../helpers/fixtures.js';
import { makeUser } from '../../../helpers/user-service.js';

import type { SessionResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const real = { ...(await import('@/services/auth/index.js')) };
const user = makeUser('employee', '00000000-0000-4000-8000-0000000000c1');
const refresh = mock((_params: { token: string }) =>
  Promise.resolve({
    access_token: 'access-2',
    expires_in: 900,
    refresh_expires_in: 604_800,
    refresh_token: 'refresh-2',
    user,
  }),
);
await mock.module('@/services/auth/index.js', () => ({
  ...real,
  authService: { refresh },
}));

afterAll(() => {
  void mock.module('@/services/auth/index.js', () => real);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { refresh: controller } = await import('@/controllers/auth/refresh.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>;
type Req = FastifyRequest;

describe('auth.controller.refresh', () => {
  it('rotates the cookie and returns a new access token', async () => {
    const { fake, reply } = makeReply<Rep>();
    await controller(makeReq<Req>({ cookies: { tm_refresh: 'refresh-1' } }), reply);
    expect(refresh).toHaveBeenCalledWith({ token: 'refresh-1' });
    expect(fake.cookies['tm_refresh']).toBe('refresh-2');
    expect(fake.sent).toMatchObject({
      data: { access_token: 'access-2' },
      event: 'auth.refreshed',
    });
  });

  it('rejects a missing cookie with 401 and clears it', async () => {
    const { fake, reply } = makeReply<Rep>();
    const error = await caught(controller(makeReq<Req>(), reply));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
    expect(error.status).toBe(401);
    expect(fake.cleared).toContain('tm_refresh');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('clears the cookie when the service rejects the token', async () => {
    const { AuthSessionInvalidError } = await import('@/lib/errors/domains/auth.js');
    refresh.mockImplementationOnce(() => Promise.reject(AuthSessionInvalidError()));
    const { fake, reply } = makeReply<Rep>();
    const error = await caught(controller(makeReq<Req>({ cookies: { tm_refresh: 'old' } }), reply));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
    expect(fake.cleared).toContain('tm_refresh');
  });
});
