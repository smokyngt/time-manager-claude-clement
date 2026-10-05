import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { caught, OTHER_ID, userOf } from '../../services/user/support.js';
import { cookieReply, installAuthService } from './support.js';

import type { AuthCallbackQuery } from '@/controllers/auth/index.js';
import type { FastifyRequest } from 'fastify';

const harness = await installAuthService();
const { svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
});

const { callback } = await import('@/controllers/auth/callback.js');

type Req = FastifyRequest<{ Querystring: AuthCallbackQuery }>;

const run = async (query: AuthCallbackQuery) => {
  const { fake: reply, reply: target } = cookieReply();
  const req = Object.assign(Fake.request({ query }), { cookies: { tm_oauth: 'state-cookie' } });
  await callback(req as Req, target);

  return { reply, req };
};

describe('auth.controller.callback', () => {
  it('sets the refresh cookie, clears the state cookie and redirects to the web app', async () => {
    svc.callback.mockImplementationOnce(() =>
      Promise.resolve({
        access_token: 'access',
        expires_in: 900,
        refresh_expires_in: 604_800,
        refresh_token: 'refresh-ms',
        user: userOf('employee', OTHER_ID),
      }),
    );
    const { reply } = await run({ code: 'c', state: 's' });
    expect(svc.callback).toHaveBeenCalledWith({ code: 'c', state: 's', state_cookie: 'state-cookie' });
    expect(reply.jar['tm_refresh']?.value).toBe('refresh-ms');
    expect(reply.redirected).toBe('http://localhost:5173/auth/callback');
    expect(reply.cleared).toContain('tm_oauth');
  });

  it('redirects with the dotted error code when the sign-in is refused', async () => {
    const { AuthMicrosoftUnknownUserError } = await import('@/lib/errors/domains/auth.js');
    svc.callback.mockImplementationOnce(() => Promise.reject(AuthMicrosoftUnknownUserError()));
    const { reply } = await run({ code: 'c', state: 's' });
    expect(reply.redirected).toBe(
      'http://localhost:5173/auth/callback?error=auth.microsoft.unknown.user',
    );
    expect(reply.jar['tm_refresh']).toBeUndefined();
  });

  it('never logs the code or the state', async () => {
    svc.callback.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const { req } = await run({ code: 'secret-code', state: 'secret-state' });
    expect(JSON.stringify(req.log.calls)).not.toContain('secret-code');
    expect(JSON.stringify(req.log.calls)).not.toContain('secret-state');
  });

  it('redirects with an error when Microsoft reports a denial or params are missing', async () => {
    const denied = await run({ error: 'access_denied' });
    const missing = await run({ code: 'c' });
    expect(denied.reply.redirected).toContain('error=auth.microsoft.rejected');
    expect(missing.reply.redirected).toContain('error=auth.microsoft.rejected');
    expect(svc.callback).not.toHaveBeenCalled();
  });

  it('answers 503 instead of redirecting when Microsoft is not configured', async () => {
    const { AuthMicrosoftUnavailableError } = await import('@/lib/errors/domains/auth.js');
    svc.callback.mockImplementationOnce(() => Promise.reject(AuthMicrosoftUnavailableError()));
    const error = await caught(run({ code: 'c', state: 's' }));
    expect([error.code, error.status]).toEqual(['auth.microsoft.unavailable', 503]);
  });
});
