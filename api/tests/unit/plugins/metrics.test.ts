import { afterEach, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';

import { ErrorHandler } from '@/lib/errors/handler.js';
import { metrics } from '@/plugins/metrics.js';

import type { MetricsOptions } from '@/plugins/metrics.js';

const build = async (options: MetricsOptions) => {
  const app = Fastify();
  app.setErrorHandler((error, req, reply) => ErrorHandler.handle(error, req, reply));
  await app.register(metrics, options);
  app.get('/items/:id', () => ({ ok: true }));
  await app.ready();
  return app;
};

const apps: Awaited<ReturnType<typeof build>>[] = [];
const make = async (options: MetricsOptions) => {
  const app = await build(options);
  apps.push(app);
  return app;
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('GET /metrics', () => {
  it('is open outside production without a token', async () => {
    const app = await make({ poolMax: 10, production: false });
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('process_cpu_user_seconds_total');
    expect(response.body).toContain('db_pool_max_connections 10');
  });

  it('is a 404 in production without a token', async () => {
    const app = await make({ production: true });
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(404);
  });

  it('requires the bearer token when configured', async () => {
    const app = await make({ production: true, token: 'secret' });
    expect((await app.inject({ method: 'GET', url: '/metrics' })).statusCode).toBe(401);
    const wrong = await app.inject({
      headers: { authorization: 'Bearer wrong' },
      method: 'GET',
      url: '/metrics',
    });
    expect(wrong.statusCode).toBe(401);
    const right = await app.inject({
      headers: { authorization: 'Bearer secret' },
      method: 'GET',
      url: '/metrics',
    });
    expect(right.statusCode).toBe(200);
  });

  it('labels the histogram with the route template, not the raw url', async () => {
    const app = await make({ production: false });
    await app.inject({ method: 'GET', url: '/items/123' });
    await app.inject({ method: 'GET', url: '/nowhere/456' });
    const body = (await app.inject({ method: 'GET', url: '/metrics' })).body;
    expect(body).toContain(
      'http_request_duration_seconds_count{method="GET",route="/items/:id",status_code="200"} 1',
    );
    expect(body).toContain('route="unmatched",status_code="404"');
    expect(body).not.toContain('/items/123');
    expect(body).not.toContain('route="/metrics"');
  });
});
