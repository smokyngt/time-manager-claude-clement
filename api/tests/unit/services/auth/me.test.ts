import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { UserNotFoundError } from '@/lib/errors/domains/user.js';

import { actorOf } from '../user/support.js';
import { caught, OTHER_ID } from './support.js';

import type { User } from '@/types/entities/user.js';

const real = { ...(await import('@/services/user/index.js')) };
const retrieve = mock((_params: { id: string }): Promise<{ user: User }> => Promise.reject(new Error('unset')));
await mock.module('@/services/user/index.js', () => ({
  ...real,
  userService: { retrieve },
}));

afterAll(() => {
  void mock.module('@/services/user/index.js', () => real);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { me } = await import('@/services/auth/me.js');
const { userOf } = await import('../user/support.js');

const actor = actorOf('employee', OTHER_ID);

describe('auth.service.me', () => {
  it('returns the current user', async () => {
    retrieve.mockImplementationOnce(() => Promise.resolve({ user: userOf('employee', OTHER_ID) }));
    const { user } = await me({ actor });
    expect(user.id).toBe(OTHER_ID);
    expect(retrieve).toHaveBeenCalledWith({ id: OTHER_ID });
  });

  it('treats a deleted user as an invalid token', async () => {
    retrieve.mockImplementationOnce(() => Promise.reject(UserNotFoundError()));
    const error = await caught(me({ actor }));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('treats an archived user as an invalid token', async () => {
    retrieve.mockImplementationOnce(() =>
      Promise.resolve({ user: userOf('employee', OTHER_ID, { archived_at: 1 }) }),
    );
    const error = await caught(me({ actor }));
    expect(error.code).toBe('token.authentication.failed');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    retrieve.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(me({ actor }));
    expect(error.code).toBe('auth.me.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.service.me');
  });
});
