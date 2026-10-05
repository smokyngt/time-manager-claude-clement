import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';

import { ErrorHandler } from '@/lib/errors/handler.js';
import { Metrics } from '@/lib/telemetry/metrics.js';
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

beforeEach(() => {
  Metrics.reset();
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('GET /metrics', () => {
  it('is open outside production without a token', async () => {
    const app = await make({ production: false });
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('process_cpu_user_seconds_total');
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

  it('negotiates the OpenMetrics format', async () => {
    const app = await make({ production: false });
    const response = await app.inject({
      headers: { accept: 'application/openmetrics-text' },
      method: 'GET',
      url: '/metrics',
    });
    expect(response.headers['content-type']).toContain('openmetrics-text');
    expect(response.body.trimEnd().endsWith('# EOF')).toBe(true);
  });

  it('declares the route hidden for swagger', async () => {
    let hidden: unknown;
    const app = Fastify();
    app.addHook('onRoute', (route) => {
      if (route.url === '/metrics') hidden = (route.schema)?.hide;
    });
    await app.register(metrics, { production: false });
    await app.ready();
    apps.push(app);
    expect(hidden).toBe(true);
  });
});
