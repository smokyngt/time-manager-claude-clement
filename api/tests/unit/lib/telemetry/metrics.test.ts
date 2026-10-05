import { afterEach, describe, expect, it } from 'bun:test';

import { Metrics } from '@/lib/telemetry/metrics.js';

afterEach(() => {
  Metrics.reset();
});

describe('Metrics.gate', () => {
  it('allows outside production without a token', () => {
    expect(Metrics.gate({ header: undefined, production: false, token: undefined })).toBe('allow');
  });

  it('hides the endpoint in production without a token', () => {
    expect(Metrics.gate({ header: 'Bearer x', production: true, token: undefined })).toBe('hide');
  });

  it('requires the exact bearer token when configured', () => {
    expect(Metrics.gate({ header: undefined, production: true, token: 's' })).toBe('deny');
    expect(Metrics.gate({ header: 'Bearer nope', production: false, token: 's' })).toBe('deny');
    expect(Metrics.gate({ header: 'Basic s', production: false, token: 's' })).toBe('deny');
    expect(Metrics.gate({ header: 'Bearer s', production: true, token: 's' })).toBe('allow');
  });
});

describe('Metrics.route', () => {
  it('falls back to unmatched', () => {
    expect(Metrics.route(undefined)).toBe('unmatched');
    expect(Metrics.route('/v1/users/:id')).toBe('/v1/users/:id');
  });
});

describe('Metrics counters', () => {
  it('counts events and errors by label', async () => {
    Metrics.event('clock.in');
    Metrics.event('clock.in');
    Metrics.error('NOT_FOUND', 404);
    const { body, type } = await Metrics.scrape(undefined);
    expect(type).toContain('text/plain');
    expect(body).toContain('tm_events_total{code="clock.in"} 2');
    expect(body).toContain('tm_errors_total{code="NOT_FOUND",status="404"} 1');
  });

  it('prefixes default metrics with tm_', async () => {
    const { body } = await Metrics.scrape(undefined);
    expect(body).toContain('tm_process_cpu_user_seconds_total');
  });
});

describe('Metrics.bind', () => {
  it('reads open clocks and pool size at scrape time', async () => {
    Metrics.bind({ openClocks: () => Promise.resolve(7), poolMax: 10 });
    const { body } = await Metrics.scrape(undefined);
    expect(body).toContain('tm_open_clocks 7');
    expect(body).toContain('tm_db_pool_max_connections 10');
  });

  it('reports NaN instead of failing the scrape when the source fails', async () => {
    Metrics.bind({ openClocks: () => Promise.reject(new Error('down')) });
    const { body } = await Metrics.scrape(undefined);
    expect(body).toMatch(/^tm_open_clocks nan$/im);
  });
});

describe('Metrics.observe and exemplars', () => {
  it('attaches the trace id only in the OpenMetrics format', async () => {
    const trace = '0af7651916cd43dd8448eb211c80319c';
    Metrics.observe({ method: 'GET', route: '/x', seconds: 0.02, status: 200, trace });
    const open = await Metrics.scrape('application/openmetrics-text; version=1.0.0');
    expect(open.type).toContain('openmetrics-text');
    expect(open.body).toContain(`# {trace_id="${trace}"} 0.02`);
    expect(open.body.trimEnd().endsWith('# EOF')).toBe(true);
    const text = await Metrics.scrape('text/plain');
    expect(text.body).not.toContain('trace_id');
    expect(text.body).toContain(
      'http_request_duration_seconds_count{method="GET",route="/x",status_code="200"} 1',
    );
  });

  it('records no exemplar without a trace', async () => {
    Metrics.observe({ method: 'GET', route: '/y', seconds: 0.02, status: 200 });
    const open = await Metrics.scrape('application/openmetrics-text');
    expect(open.body).not.toContain('trace_id');
  });
});
