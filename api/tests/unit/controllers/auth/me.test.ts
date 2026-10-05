import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { actorOf, caught, OTHER_ID, userOf } from '../../services/user/support.js';
import { cookieReply, installAuthService } from './support.js';

import type { MeResponse } from '@/controllers/auth/index.js';
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

const { me } = await import('@/controllers/auth/me.js');
const { Roles } = await import('@/config/auth/roles.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<MeResponse> }>;

describe('auth.controller.me', () => {
  it('replies with the user and the scopes of the request context', async () => {
    svc.me.mockImplementationOnce(() => Promise.resolve({ user: userOf('manager', OTHER_ID) }));
    const actor = actorOf('manager', OTHER_ID);
    const reply = cookieReply<Rep>();
    await me(Fake.request({ actor, scopes: Roles.scopes('manager') }), reply);
    expect(svc.me).toHaveBeenCalledWith({ actor });
    expect(reply.payload).toMatchObject({
      data: { user: { id: OTHER_ID } },
      event: { code: 'auth.retrieved', payload: { actor: OTHER_ID } },
    });
    const { data } = reply.payload as ReplyEnvelope<MeResponse>;
    expect(data.scopes).toEqual([...Roles.scopes('manager')]);
  });

  it('requires an authenticated caller', async () => {
    const error = await caught(me(Fake.request(), cookieReply<Rep>()));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
    expect(svc.me).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.me.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(
      me(Fake.request({ actor: actorOf('employee', OTHER_ID), scopes: [] }), cookieReply<Rep>()),
    );
    expect(error.code).toBe('auth.me.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.controller.me');
  });
});
