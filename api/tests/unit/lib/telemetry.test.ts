import { afterEach, describe, expect, it } from 'bun:test';
import { Writable } from 'node:stream';
import pino from 'pino';

import { Telemetry } from '@/lib/telemetry/index.js';
import { Metrics } from '@/lib/telemetry/metrics.js';

const original = { level: process.env.LOG_LEVEL, node: process.env.NODE_ENV };

afterEach(() => {
  if (original.level === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = original.level;
  if (original.node === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = original.node;
});

describe('Telemetry.id', () => {
  it('reuses a valid incoming request id', () => {
    expect(Telemetry.id({ headers: { 'x-request-id': 'abc-123_DEF' } })).toBe('abc-123_DEF');
  });

  it('accepts exactly 128 characters', () => {
    const value = 'a'.repeat(128);
    expect(Telemetry.id({ headers: { 'x-request-id': value } })).toBe(value);
  });

  it('rejects ids that are too long, malformed or empty', () => {
    for (const value of ['a'.repeat(129), 'bad id', 'x\ny', 'a/b', '']) {
      const id = Telemetry.id({ headers: { 'x-request-id': value } });
      expect(id).not.toBe(value);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('generates a uuid when absent or repeated', () => {
    expect(Telemetry.id({ headers: {} })).toMatch(/^[0-9a-f-]{36}$/);
    expect(Telemetry.id({ headers: { 'x-request-id': ['a', 'b'] } })).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('Telemetry.logger', () => {
  it('reads the level from LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';
    expect(Telemetry.logger().level).toBe('warn');
  });

  it('uses pretty output only in development', () => {
    process.env.NODE_ENV = 'development';
    expect(Telemetry.logger().transport?.target).toBe('pino-pretty');
    process.env.NODE_ENV = 'production';
    expect(Telemetry.logger().transport).toBeUndefined();
    process.env.NODE_ENV = 'test';
    expect(Telemetry.logger().transport).toBeUndefined();
  });

  it('redacts secrets from log lines', () => {
    process.env.NODE_ENV = 'production';
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pino({ redact: Telemetry.logger().redact }, stream);
    logger.info({
      body: { access_token: 'AT', password: 'PW', refresh_token: 'RT' },
      req: { headers: { authorization: 'Bearer SECRET', cookie: 'sid=SECRET' } },
      res: { headers: { 'set-cookie': 'sid=SECRET' } },
    });
    const output = lines.join('');
    for (const secret of ['AT"', 'PW', 'RT"', 'SECRET']) expect(output).not.toContain(secret);
    expect(output).toContain('[redacted]');
  });

  it('lists every required redaction path', () => {
    expect([...Telemetry.redacted]).toEqual([
      '*.access_token',
      '*.password',
      '*.refresh_token',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ]);
  });
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
