import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeReply, makeReq } from '../../../helpers/fixtures.js';

import type { LogoutResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const real = { ...(await import('@/services/auth/index.js')) };
const logoutService = mock((_params: { token: string | undefined }) =>
  Promise.resolve({ success: true, user_id: 'user-1' }),
);
await mock.module('@/services/auth/index.js', () => ({
  ...real,
  authService: { logout: logoutService },
}));

afterAll(() => {
  void mock.module('@/services/auth/index.js', () => real);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { logout } = await import('@/controllers/auth/logout.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<LogoutResponse> }>;

describe('auth.controller.logout', () => {
  it('revokes from the cookie alone and clears it', async () => {
    const { fake, reply } = makeReply<Rep>();
    await logout(makeReq<FastifyRequest>({ cookies: { tm_refresh: 'opaque' } }), reply);
    expect(logoutService).toHaveBeenCalledWith({ token: 'opaque' });
    expect(fake.cleared).toContain('tm_refresh');
    expect(fake.sent).toEqual({ data: { success: true }, event: 'auth.logged_out' });
  });

  it('answers the same envelope without any cookie or bearer token', async () => {
    logoutService.mockImplementationOnce(() => Promise.resolve({ success: true, user_id: null }));
    const { fake, reply } = makeReply<Rep>();
    await logout(makeReq<FastifyRequest>(), reply);
    expect(logoutService).toHaveBeenCalledWith({ token: undefined });
    expect(fake.sent).toEqual({ data: { success: true }, event: 'auth.logged_out' });
  });

  it('wraps failures, keeps the cause and still clears the cookie', async () => {
    const failure = new Error('db down');
    logoutService.mockImplementationOnce(() => Promise.reject(failure));
    const { fake, reply } = makeReply<Rep>();
    const error = await caught(logout(makeReq<FastifyRequest>(), reply));
    expect(error.code).toBe('AUTH_LOGOUT_ERROR');
    expect(error.cause).toBe(failure);
    expect(fake.cleared).toContain('tm_refresh');
  });
});
