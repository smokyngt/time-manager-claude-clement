import { mock } from 'bun:test';

import { FakeReply } from '../../../support/fake.js';

import type { SessionResult } from '@/services/auth/index.js';
import type { FastifyReply } from 'fastify';

export class CookieReply extends FakeReply {
  public readonly cleared: string[] = [];
  public readonly jar: Record<string, { options: unknown; value: string }> = {};
  public redirected: string | undefined;

  public clearCookie(name: string): this {
    this.cleared.push(name);

    return this;
  }

  public redirect(url: string): Promise<this> {
    this.redirected = url;

    return Promise.resolve(this);
  }

  public setCookie(name: string, value: string, options: unknown): this {
    this.jar[name] = { options, value };

    return this;
  }
}

export const cookieReply = <Reply extends FastifyReply = FastifyReply>(): {
  fake: CookieReply;
  reply: Reply;
} => {
  const fake = new CookieReply();

  return { fake, reply: fake as unknown as Reply };
};

export const installAuthService = async () => {
  const real = { ...(await import('@/services/auth/index.js')) };
  const svc = {
    authorize: mock(() =>
      Promise.resolve({ max_age: 600, state_cookie: 'signed', url: 'https://login.example/auth' }),
    ),
    callback: mock((_params: unknown): Promise<SessionResult> => Promise.reject(new Error('unset'))),
    login: mock((_params: unknown): Promise<SessionResult> => Promise.reject(new Error('unset'))),
    logout: mock((_params: unknown) =>
      Promise.resolve({ success: true, user_id: undefined as string | undefined }),
    ),
    me: mock((_params: unknown) => Promise.reject(new Error('unset'))),
    refresh: mock((_params: unknown): Promise<SessionResult> => Promise.reject(new Error('unset'))),
  };
  await mock.module('@/services/auth/index.js', () => ({ ...real, authService: svc }));

  return {
    restore: (): void => {
      void mock.module('@/services/auth/index.js', () => real);
    },
    svc,
  };
};
