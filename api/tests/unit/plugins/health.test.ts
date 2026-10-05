import { afterEach, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';

import { health } from '@/plugins/health.js';

import type { Probe } from '@/lib/lifecycle/health.js';

const build = async (probe: Probe, timeout?: number) => {
  const app = Fastify();
  await app.register(health, { probe, timeout });
  await app.ready();
  return app;
};

const body = (raw: string): unknown => JSON.parse(raw);

const apps: Awaited<ReturnType<typeof build>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('GET /health', () => {
  it('returns ok without probing dependencies', async () => {
    const app = await build(() => Promise.reject(new Error('down')));
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(body(response.body)).toEqual({ status: 'ok' });
  });
});

describe('GET /health/ready', () => {
  it('returns 200 when the database answers', async () => {
    const app = await build(() => Promise.resolve([{ '?column?': 1 }]));
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(200);
    expect(body(response.body)).toEqual({ checks: { database: 'ok' }, status: 'ok' });
  });

  it('returns 503 when the database errors', async () => {
    const app = await build(() => Promise.reject(new Error('down')));
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(body(response.body)).toEqual({
      checks: { database: 'unavailable' },
      status: 'unavailable',
    });
  });

  it('returns 503 when the database is slower than the timeout', async () => {
    const app = await build(() => new Promise(() => undefined), 30);
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
  });
});
