import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { build } from '@/app.js';

import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await build();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('app', () => {
  it('answers the health probe', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>()).toEqual({ status: 'ok' });
  });

  it('requires a bearer token on user routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10',
    });
    expect(response.statusCode).toBe(401);
    expect(response.json<Record<string, unknown>>()).toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    });
    expect(response.json<{ request_id: string }>().request_id).toBeTruthy();
  });

  it('rejects unknown body properties and bad formats before reaching the database', async () => {
    const extra = await app.inject({
      method: 'POST',
      payload: { email: 'a@b.co', password: 'pw', unexpected: true },
      url: '/v1/auth/login',
    });
    const format = await app.inject({
      method: 'POST',
      payload: { email: 'nope', password: 'pw' },
      url: '/v1/auth/login',
    });
    expect(extra.statusCode).toBe(400);
    expect(extra.json<Record<string, unknown>>()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(format.statusCode).toBe(400);
  });

  it('refuses a refresh without cookie', async () => {
    const response = await app.inject({ method: 'POST', url: '/v1/auth/refresh' });
    expect(response.statusCode).toBe(401);
    expect(response.json<Record<string, unknown>>()).toMatchObject({
      code: 'AUTH_SESSION_INVALID',
    });
  });

  it('answers 503 on Microsoft routes when unconfigured', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/auth/microsoft' });
    expect(response.statusCode).toBe(503);
    expect(response.json<Record<string, unknown>>()).toMatchObject({
      code: 'AUTH_MICROSOFT_UNAVAILABLE',
    });
  });

  it('returns the error envelope for unknown routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json<Record<string, unknown>>()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('publishes the OpenAPI document with users and auth tags', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const spec = response.json<{ paths: Record<string, unknown>; tags: { name: string }[] }>();
    expect(spec.tags.map((tag) => tag.name)).toEqual(['auth', 'users']);
    expect(Object.keys(spec.paths)).toContain('/v1/users/new');
    expect(JSON.stringify(spec)).not.toContain('password_hash');
  });
});
