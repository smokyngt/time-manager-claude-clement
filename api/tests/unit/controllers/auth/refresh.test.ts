import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { caught, OTHER_ID, userOf } from '../../services/user/support.js';
import { cookieReply, installAuthService } from './support.js';

import type { AuthSessionResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply } from 'fastify';

const harness = await installAuthService();
const { svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
});

const { refresh } = await import('@/controllers/auth/refresh.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<AuthSessionResponse> }>;

const run = async (token?: string) => {
  const { fake: reply, reply: target } = cookieReply<Rep>();
  const req = Object.assign(Fake.request(), { cookies: token === undefined ? {} : { tm_refresh: token } });
  await refresh(req, target);

  return reply;
};

describe('auth.controller.refresh', () => {
  it('rotates the cookie and replies with the session and scopes', async () => {
    svc.refresh.mockImplementationOnce(() =>
      Promise.resolve({
        access_token: 'access2',
        expires_in: 900,
        refresh_expires_in: 604_800,
        refresh_token: 'refresh2',
        user: userOf('employee', OTHER_ID),
      }),
    );
    const reply = await run('refresh1');
    expect(svc.refresh).toHaveBeenCalledWith({ token: 'refresh1' });
    expect(reply.jar['tm_refresh']?.value).toBe('refresh2');
    expect(reply.payload).toMatchObject({
      data: { access_token: 'access2', token_type: 'Bearer' },
      event: { code: 'auth.refreshed' },
    });
  });

  it('rejects a missing cookie with auth.refresh.invalid and clears it', async () => {
    const { fake: reply, reply: target } = cookieReply<Rep>();
    const req = Object.assign(Fake.request(), { cookies: {} });
    const error = await caught(refresh(req, target));
    expect([error.code, error.status]).toEqual(['auth.refresh.invalid', 401]);
    expect(reply.cleared).toContain('tm_refresh');
    expect(svc.refresh).not.toHaveBeenCalled();
  });

  it('clears the cookie when the service rejects the token', async () => {
    const { AuthRefreshInvalidError } = await import('@/lib/errors/domains/auth.js');
    svc.refresh.mockImplementationOnce(() => Promise.reject(AuthRefreshInvalidError()));
    const { fake: reply, reply: target } = cookieReply<Rep>();
    const req = Object.assign(Fake.request(), { cookies: { tm_refresh: 'old' } });
    const error = await caught(refresh(req, target));
    expect(error.code).toBe('auth.refresh.invalid');
    expect(reply.cleared).toContain('tm_refresh');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.refresh.mockImplementationOnce(() => Promise.reject(failure));
    const { reply: target } = cookieReply<Rep>();
    const req = Object.assign(Fake.request(), { cookies: { tm_refresh: 'old' } });
    const error = await caught(refresh(req, target));
    expect(error.code).toBe('auth.refresh.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.controller.refresh');
  });
});
