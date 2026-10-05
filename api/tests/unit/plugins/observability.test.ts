import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';

import { Telemetry } from '@/lib/telemetry/index.js';
import { Metrics } from '@/lib/telemetry/metrics.js';
import { observability } from '@/plugins/observability.js';

import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ genReqId: (req) => Telemetry.id(req), requestIdHeader: false });
  await app.register(observability);
  app.get('/ping', () => ({ ok: true }));
  app.get('/metrics', () => 'x');
  await app.ready();
});

beforeEach(() => {
  Metrics.reset();
});

afterAll(async () => {
  await app.close();
});

describe('observability plugin', () => {
  it('echoes a valid incoming request id', async () => {
    const response = await app.inject({
      headers: { 'x-request-id': 'trace-42' },
      method: 'GET',
      url: '/ping',
    });
    expect(response.headers['x-request-id']).toBe('trace-42');
  });

  it('replaces an invalid request id with a uuid', async () => {
    const response = await app.inject({
      headers: { 'x-request-id': 'bad id!' },
      method: 'GET',
      url: '/ping',
    });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets the header on not found responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/missing' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('records the duration histogram with the route template', async () => {
    await app.inject({ method: 'GET', url: '/ping' });
    await app.inject({ method: 'GET', url: '/nowhere/456' });
    const { body } = await Metrics.scrape(undefined);
    expect(body).toContain(
      'http_request_duration_seconds_count{method="GET",route="/ping",status_code="200"} 1',
    );
    expect(body).toContain('route="unmatched",status_code="404"');
    expect(body).not.toContain('/nowhere/456');
  });

  it('does not record the metrics endpoint itself', async () => {
    await app.inject({ method: 'GET', url: '/metrics' });
    const { body } = await Metrics.scrape(undefined);
    expect(body).not.toContain('route="/metrics"');
  });
});
