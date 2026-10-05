import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { caught, OTHER_ID, userOf } from '../../services/user/support.js';
import { cookieReply, installAuthService } from './support.js';

import type { LoginBody, SessionResponse } from '@/controllers/auth/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installAuthService();
const { svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
});

const { login } = await import('@/controllers/auth/login.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>;
type Req = FastifyRequest<{ Body: LoginBody }>;

const session = (role: 'admin' | 'employee' | 'manager' = 'employee') => ({
  access_token: 'access',
  expires_in: 900,
  refresh_expires_in: 604_800,
  refresh_token: 'refresh',
  user: userOf(role, OTHER_ID),
});

const run = async () => {
  const { fake: reply, reply: target } = cookieReply<Rep>();
  await login(
    Fake.request({ body: { email: 'jane.doe@example.com', password: 'pw' } }) as Req,
    target,
  );

  return reply;
};

describe('auth.controller.login', () => {
  it('sets the refresh cookie and replies with the named session and scopes', async () => {
    svc.login.mockImplementationOnce(() => Promise.resolve(session('manager')));
    const reply = await run();
    expect(svc.login).toHaveBeenCalledWith({ email: 'jane.doe@example.com', password: 'pw' });
    expect(reply.jar['tm_refresh']?.value).toBe('refresh');
    expect(reply.jar['tm_refresh']?.options).toMatchObject({
      httpOnly: true,
      maxAge: 604_800,
      path: '/v1/auth',
      sameSite: 'lax',
    });
    expect(reply.payload).toMatchObject({
      data: {
        access_token: 'access',
        expires_in: 900,
        token_type: 'Bearer',
        user: { id: OTHER_ID },
      },
      event: { code: 'auth.logged_in', correlation_id: 'req-test', payload: { actor: OTHER_ID } },
    });
    const { data } = reply.payload as ReplyEnvelope<SessionResponse>;
    expect(data.scopes).toContain('teams:manage');
    expect(data).not.toHaveProperty('refresh_token');
  });

  it('gives an employee only employee scopes', async () => {
    svc.login.mockImplementationOnce(() => Promise.resolve(session()));
    const reply = await run();
    const { data } = reply.payload as ReplyEnvelope<SessionResponse>;
    expect(data.scopes).toContain('auth:self');
    expect(data.scopes).not.toContain('users:manage');
  });

  it('keeps the credential and rate limit errors raised by the service', async () => {
    const { AuthCredentialsInvalidError, AuthRateLimitedError } = await import(
      '@/lib/errors/domains/auth.js'
    );
    svc.login.mockImplementationOnce(() => Promise.reject(AuthCredentialsInvalidError()));
    const invalid = await caught(run());
    svc.login.mockImplementationOnce(() => Promise.reject(AuthRateLimitedError()));
    const limited = await caught(run());
    expect([invalid.code, invalid.status]).toEqual(['auth.credentials.invalid', 401]);
    expect([limited.code, limited.status]).toEqual(['auth.rate.limited', 429]);
  });

  it('wraps unexpected failures with the controller route and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.login.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(run());
    expect(error.code).toBe('auth.login.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.controller.login');
  });
});
