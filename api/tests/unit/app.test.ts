import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { build } from '@/app.js';
import { ValidationError } from '@/lib/errors/base/core.js';

import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await build({ logger: false });
  app.post(
    '/echo',
    {
      schema: {
        body: {
          additionalProperties: false,
          properties: { age: { type: 'integer' }, name: { minLength: 1, type: 'string' } },
          required: ['name'],
          type: 'object',
        },
      },
    },
    (req) => ({ body: req.body }),
  );
  app.get('/boom', () => {
    throw new Error('boom');
  });
  app.get('/domain', () => {
    throw ValidationError({ metadata: { why: 'test' } });
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('app', () => {
  it('echoes a valid x-request-id and replaces an invalid one', async () => {
    const ok = await app.inject({ headers: { 'x-request-id': 'abc_123-X' }, url: '/health' });
    expect(ok.headers['x-request-id']).toBe('abc_123-X');
    const bad = await app.inject({ headers: { 'x-request-id': 'bad id!' }, url: '/health' });
    expect(bad.headers['x-request-id']).not.toBe('bad id!');
    expect(String(bad.headers['x-request-id']).length).toBeGreaterThan(10);
  });

  it('serves health', async () => {
    const response = await app.inject({ url: '/health' });
    expect(response.json<Record<string, unknown>>()).toEqual({ status: 'ok' });
  });

  it('puts the request id in error bodies', async () => {
    const response = await app.inject({ headers: { 'x-request-id': 'req-9' }, url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json<Record<string, unknown>>()).toMatchObject({
      code: 'route.not.found',
      correlation_id: 'req-9',
      instance: '/nope',
      status: 404,
    });
    expect(response.headers['x-request-id']).toBe('req-9');
  });

  it('turns thrown errors into problem bodies', async () => {
    const domain = await app.inject({ url: '/domain' });
    expect(domain.statusCode).toBe(400);
    const boom = await app.inject({ url: '/boom' });
    expect(boom.statusCode).toBe(500);
    expect(boom.json<{ code: string }>().code).toBe('internal.unexpected');
  });

  it('reports validation failures with errors[]', async () => {
    const response = await app.inject({ method: 'POST', payload: {}, url: '/echo' });
    expect(response.statusCode).toBe(400);
    expect(response.json<Record<string, unknown>>()).toMatchObject({
      code: 'validation.error',
      errors: [{ code: 'required', params: { missing_property: 'name' }, path: 'body.name' }],
    });
  });

  it('strips unknown fields, coerces types and sanitizes strings', async () => {
    const response = await app.inject({
      method: 'POST',
      payload: { age: '7', extra: 1, name: '  Jo\u0000e  ' },
      url: '/echo',
    });
    expect(response.json<Record<string, unknown>>()).toEqual({ body: { age: 7, name: 'Joe' } });
  });

  it('drops prototype keys and refuses __proto__ at parse time', async () => {
    const headers = { 'content-type': 'application/json' };
    const clean = await app.inject({
      headers,
      method: 'POST',
      payload: '{"name":"a","constructor":{"x":1}}',
      url: '/echo',
    });
    expect(clean.json<Record<string, unknown>>()).toEqual({ body: { name: 'a' } });
    const proto = await app.inject({
      headers,
      method: 'POST',
      payload: '{"name":"a","__proto__":{"x":1}}',
      url: '/echo',
    });
    expect(proto.statusCode).toBe(400);
  });

  it('rejects bodies deeper than the limit', async () => {
    let deep: unknown = 'x';
    for (let index = 0; index < 12; index += 1) deep = { a: deep };
    const response = await app.inject({
      method: 'POST',
      payload: { name: 'a', z: deep },
      url: '/echo',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('validation.error');
  });

  it('rejects malformed JSON with json.invalid', async () => {
    const response = await app.inject({
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      payload: '{bad',
      url: '/echo',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('json.invalid');
  });

  it('publishes the OpenAPI document with every tag, router and security scheme', async () => {
    const response = await app.inject({ url: '/docs/json' });
    const spec = response.json<{
      components: { securitySchemes: Record<string, { in?: string; name?: string; type: string }> };
      paths: Record<string, unknown>;
      tags: { name: string }[];
    }>();
    expect(response.statusCode).toBe(200);
    expect(spec.tags.map((tag) => tag.name)).toEqual([
      'auth',
      'clocks',
      'health',
      'reports',
      'team-members',
      'teams',
      'users',
    ]);
    const paths = Object.keys(spec.paths);
    for (const path of [
      '/v1/auth/login',
      '/v1/clocks/in',
      '/v1/reports/user',
      '/v1/teams/new',
      '/v1/teams/{id}/members/list',
      '/v1/users/new',
    ]) {
      expect(paths).toContain(path);
    }
    expect(spec.components.securitySchemes['cookieAuth']).toMatchObject({
      in: 'cookie',
      name: 'tm_refresh',
      type: 'apiKey',
    });
    expect(JSON.stringify(spec)).not.toContain('password_hash');
    expect(JSON.stringify(spec)).not.toContain('email_hash');
  });

  it('requires a bearer token on every resource router', async () => {
    const urls = [
      ['GET', '/v1/users/0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10'],
      ['GET', '/v1/teams/0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10'],
      ['GET', '/v1/clocks/current'],
      ['GET', '/v1/clocks/0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10'],
    ] as const;
    for (const [method, url] of urls) {
      const response = await app.inject({ method, url });
      expect(response.statusCode).toBe(401);
      expect(response.json<{ code: string }>().code).toBe('token.authentication.failed');
    }
  });

  it('returns route.not.found for unknown routes', async () => {
    const response = await app.inject({ url: '/v1/unknown' });
    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('route.not.found');
  });

  it('answers 401 on refresh without cookie and 503 on unconfigured Microsoft', async () => {
    const refresh = await app.inject({ method: 'POST', url: '/v1/auth/refresh' });
    expect(refresh.statusCode).toBe(401);
    expect(refresh.json<{ code: string }>().code).toBe('auth.refresh.invalid');
    const microsoft = await app.inject({ url: '/v1/auth/microsoft' });
    expect(microsoft.statusCode).toBe(503);
    expect(microsoft.json<{ code: string }>().code).toBe('auth.microsoft.unavailable');
  });
});
