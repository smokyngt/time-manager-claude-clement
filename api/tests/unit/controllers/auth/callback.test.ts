import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeReply, makeReq } from '../../../helpers/fixtures.js';
import { makeUser } from '../../../helpers/user-service.js';

import type { CallbackQuery } from '@/controllers/auth/index.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const real = { ...(await import('@/services/auth/index.js')) };
const user = makeUser('employee', '00000000-0000-4000-8000-0000000000c1');
const callbackService = mock((_params: { code: string; state: string }) =>
  Promise.resolve({
    access_token: 'access',
    expires_in: 900,
    refresh_expires_in: 604_800,
    refresh_token: 'refresh-ms',
    user,
  }),
);
await mock.module('@/services/auth/index.js', () => ({
  ...real,
  authService: { callback: callbackService },
}));

afterAll(() => {
  void mock.module('@/services/auth/index.js', () => real);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { callback } = await import('@/controllers/auth/callback.js');

type Req = FastifyRequest<{ Querystring: CallbackQuery }>;

describe('auth.controller.callback', () => {
  it('sets the refresh cookie and redirects to the web callback', async () => {
    const { fake, reply } = makeReply<FastifyReply>();
    await callback(
      makeReq<Req>({ cookies: { tm_oauth: 'state' }, query: { code: 'c', state: 's' } }),
      reply,
    );
    expect(fake.cookies['tm_refresh']).toBe('refresh-ms');
    expect(fake.redirected).toBe('http://localhost:5173/auth/callback');
    expect(fake.cleared).toContain('tm_oauth');
  });

  it('redirects with the error code when the sign-in is refused', async () => {
    const { AuthMicrosoftUnknownUserError } = await import('@/lib/errors/domains/auth.js');
    callbackService.mockImplementationOnce(() => Promise.reject(AuthMicrosoftUnknownUserError()));
    const { fake, reply } = makeReply<FastifyReply>();
    await callback(makeReq<Req>({ query: { code: 'c', state: 's' } }), reply);
    expect(fake.redirected).toBe(
      'http://localhost:5173/auth/callback?error=AUTH_MICROSOFT_UNKNOWN_USER',
    );
    expect(fake.cookies['tm_refresh']).toBeUndefined();
  });

  it('redirects with an error when Microsoft reports a denial', async () => {
    const { fake, reply } = makeReply<FastifyReply>();
    await callback(makeReq<Req>({ query: { error: 'access_denied' } }), reply);
    expect(fake.redirected).toContain('error=AUTH_MICROSOFT_REJECTED');
    expect(callbackService).not.toHaveBeenCalled();
  });

  it('answers 503 instead of redirecting when Microsoft is not configured', async () => {
    const { AuthMicrosoftUnavailableError } = await import('@/lib/errors/domains/auth.js');
    callbackService.mockImplementationOnce(() => Promise.reject(AuthMicrosoftUnavailableError()));
    const { reply } = makeReply<FastifyReply>();
    const error = await caught(callback(makeReq<Req>({ query: { code: 'c', state: 's' } }), reply));
    expect(error.code).toBe('AUTH_MICROSOFT_UNAVAILABLE');
    expect(error.status).toBe(503);
  });
});
