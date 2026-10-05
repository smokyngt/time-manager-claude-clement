import { afterEach, describe, expect, it } from 'bun:test';

import { Tracing } from '@/lib/telemetry/tracing.js';

const original = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

afterEach(async () => {
  await Tracing.stop();
  if (original === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = original;
});

describe('Tracing.start', () => {
  it('does nothing without an endpoint', () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    expect(Tracing.enabled()).toBe(false);
    expect(Tracing.start()).toBe(false);
  });

  it('starts once when an endpoint is set and stops cleanly', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://127.0.0.1:1';
    expect(Tracing.enabled()).toBe(true);
    expect(Tracing.start()).toBe(true);
    expect(Tracing.start()).toBe(false);
    await Tracing.stop();
    await Tracing.stop();
  });
});

describe('Tracing.span', () => {
  it('returns the callback result', async () => {
    expect(await Tracing.span('test.ok', () => Promise.resolve(42))).toBe(42);
  });

  it('rethrows callback errors', async () => {
    const error = await Tracing.span('test.fail', () => Promise.reject(new Error('boom'))).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('boom');
  });
});
