import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test';

import { Roles } from '@/config/auth/roles.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { Identity } from '@/middlewares/auth/identity.js';

import { FakeDb } from '../../../support/db.js';
import { Prehandler } from '../../../support/prehandler.js';
import { actorOf, ADMIN_ID, rowOf } from '../../services/user/support.js';

import type { UserResponse } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyInstance } from 'fastify';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

const { users } = await import('@/routes/user/index.js');

let app: FastifyInstance;
let authorization = '';

beforeAll(async () => {
  spyOn(Roles, 'scopes').mockImplementation(() => ['users:manage', 'users:read']);
  spyOn(Identity, 'load').mockImplementation(() => Promise.resolve(actorOf('admin')));
  app = await Prehandler.app(users, '/v1/users');
  const { token } = await Tokens.access({ id: ADMIN_ID, role: 'admin' });
  authorization = `Bearer ${token}`;
});

afterEach(() => {
  fakeDb.reset();
});

afterAll(async () => {
  await app.close();
  mock.restore();
  void mock.module('@/db/client.js', () => realDb);
});

describe('routes.user round trip', () => {
  it('creates a user and lists it with the response envelope and without secrets', async () => {
    fakeDb.enqueue([rowOf()], []);
    const created = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { email: 'Jane.Doe@Example.com', first_name: 'Jane', last_name: 'Doe' },
      url: '/v1/users/new',
    });
    expect(created.statusCode).toBe(200);
    const body = created.json<ReplyEnvelope<UserResponse>>();
    expect(body.data.user).toMatchObject({
      email: 'jane.doe@example.com',
      first_name: 'Jane',
      object: 'user',
      role: 'employee',
    });
    expect(body.event).toMatchObject({
      code: 'user.created',
      payload: { actor: ADMIN_ID, user_id: body.data.user.id },
    });
    expect(body.event.correlation_id).toBeString();
    expect(JSON.stringify(body)).not.toContain('hash');

    fakeDb.enqueue([rowOf()], [{ total: 1 }]);
    const listed = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { limit: 10 },
      url: '/v1/users/list',
    });
    expect(listed.statusCode).toBe(200);
    const page = listed.json<ReplyEnvelope<{ items: unknown[]; more: boolean; total: number }>>();
    expect(page.data).toMatchObject({ more: false, next: null, total: 1 });
    expect(page.data.items).toHaveLength(1);
    expect(page.event.code).toBe('user.listed');
    expect(JSON.stringify(page)).not.toContain('hash');
  });

  it('rejects an invalid body with validation.error', async () => {
    const response = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { email: 'not-an-email' },
      url: '/v1/users/new',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('validation.error');
  });

  it('answers 409 duplicate.key on a unique violation', async () => {
    fakeDb.enqueue(Object.assign(new Error('duplicate'), { code: '23505' }));
    const response = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { email: 'jane.doe@example.com', first_name: 'Jane', last_name: 'Doe' },
      url: '/v1/users/new',
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('duplicate.key');
  });

  it('answers 404 user.not.found for an unknown user', async () => {
    fakeDb.enqueue([]);
    const response = await app.inject({
      headers: { authorization },
      method: 'GET',
      url: '/v1/users/00000000-0000-4000-8000-0000000000ff',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('user.not.found');
  });
});
