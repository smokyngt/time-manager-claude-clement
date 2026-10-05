import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { OTHER_ID } from '../../services/user/support.js';
import { cookieReply, installAuthService } from './support.js';

import type { LogoutResponse } from '@/controllers/auth/index.js';
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

const { logout } = await import('@/controllers/auth/logout.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<LogoutResponse> }>;

const run = async (cookies: Record<string, string>) => {
  const { fake: reply, reply: target } = cookieReply<Rep>();
  const req = Object.assign(Fake.request(), { cookies });
  await logout(req, target);

  return { reply, req };
};

describe('auth.controller.logout', () => {
  it('revokes through the cookie token, clears the cookie and needs no actor', async () => {
    svc.logout.mockImplementationOnce(() => Promise.resolve({ success: true, user_id: OTHER_ID }));
    const { reply } = await run({ tm_refresh: 'opaque' });
    expect(svc.logout).toHaveBeenCalledWith({ token: 'opaque' });
    expect(reply.cleared).toContain('tm_refresh');
    expect(reply.payload).toMatchObject({
      data: { success: true },
      event: { code: 'auth.logged_out', payload: { actor: OTHER_ID } },
    });
  });

  it('succeeds without a cookie and omits the actor', async () => {
    const { reply } = await run({});
    expect(svc.logout).toHaveBeenCalledWith({ token: undefined });
    expect(reply.cleared).toContain('tm_refresh');
    expect(reply.payload).toMatchObject({ data: { success: true }, event: { payload: {} } });
  });

  it('still succeeds, clears the cookie and logs a warning when revocation fails', async () => {
    svc.logout.mockImplementationOnce(() => Promise.reject(new Error('db down')));
    const { reply, req } = await run({ tm_refresh: 'opaque' });
    expect(reply.statusCode).toBe(200);
    expect(reply.cleared).toContain('tm_refresh');
    expect(reply.payload).toMatchObject({ data: { success: true } });
    expect(req.log.calls.some((call) => call.level === 'warn')).toBe(true);
  });
});
