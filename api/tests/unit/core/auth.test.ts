import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';

import { Tokens } from '@/lib/auth/tokens.js';
import { TokenAuthenticationError } from '@/lib/errors/base/core.js';
import { AppError } from '@/lib/errors/base/registry.js';
import { Identity } from '@/middlewares/auth/identity.js';
import { auth } from '@/middlewares/auth/index.js';
import { Access } from '@/utils/auth/authz.js';

import { Fake } from '../../support/fake.js';

import type { Role } from '@/types/entities/user.js';

let loaded: { archived: boolean; missing: boolean; role: Role } = {
  archived: false,
  missing: false,
  role: 'employee',
};

const spy = spyOn(Identity, 'load').mockImplementation((actorId: string) => {
  if (loaded.missing || loaded.archived) {
    return Promise.reject(TokenAuthenticationError({ metadata: { actor_id: actorId } }));
  }

  return Promise.resolve({ id: actorId, role: loaded.role, team_ids: [] });
});

afterEach(() => {
  loaded = { archived: false, missing: false, role: 'employee' };
});

afterAll(() => {
  spy.mockRestore();
});

const request = async (role: Role = 'employee') => {
  const { token } = await Tokens.access({ id: 'user-1', role });

  return Fake.request({ headers: { authorization: `Bearer ${token}` } });
};

const failure = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
  }
  throw new TypeError('expected AppError');
};

describe('middlewares.auth', () => {
  it('rejects a missing token with 401', async () => {
    const error = await failure(auth({ scopes: [] })(Fake.request(), Fake.reply()));
    expect(error.status).toBe(401);
    expect(error.code).toBe('token.authentication.failed');
  });

  it('rejects an invalid token with 401', async () => {
    const req = Fake.request({ headers: { authorization: 'Bearer garbage' } });
    const error = await failure(auth({ scopes: [] })(req, Fake.reply()));
    expect(error.status).toBe(401);
    expect(error.code).toBe('token.authentication.failed');
  });

  it('rejects an archived or missing user with 401', async () => {
    loaded.archived = true;
    const error = await failure(auth({ scopes: [] })(await request(), Fake.reply()));
    expect(error.status).toBe(401);
  });

  it('rejects missing scopes with 403', async () => {
    const error = await failure(auth({ scopes: ['teams:manage'] })(await request(), Fake.reply()));
    expect(error.status).toBe(403);
    expect(error.code).toBe('unauthorized');
  });

  it('stores the user and scopes in the request context', async () => {
    loaded.role = 'manager';
    const req = await request('manager');
    await auth({ scopes: ['teams:manage'] })(req, Fake.reply());
    const context = Access.context(req);
    expect(context.actor).toEqual({ id: 'user-1', role: 'manager', team_ids: [] });
    expect(context.scopes).toContain('teams:manage');
  });

  it('accepts empty scopes for any authenticated user', async () => {
    await auth({ scopes: [] })(await request(), Fake.reply());
  });

  it('Access.context throws 401 without a user and role.require throws 403', () => {
    expect(() => Access.context(Fake.request())).toThrow();
    const req = Fake.request({ actor: { id: 'e', role: 'employee', team_ids: [] } });
    expect(() => Access.role.require(req, ['admin'])).toThrow();
    expect(Access.role.require(req, ['employee']).id).toBe('e');
  });
});
