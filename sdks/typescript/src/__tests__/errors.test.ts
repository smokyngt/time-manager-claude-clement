import { describe, expect, test } from 'bun:test';

import { ErrorCodes } from '../error-codes.js';
import {
  AuthenticationError,
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeManagerError,
  ValidationError,
} from '../errors.js';

function make(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): TimeManagerError {
  return TimeManagerError.from(new Response(null, { headers, status }), body);
}

describe('TimeManagerError.from', () => {
  const base = { code: 'x.y', correlationId: 'cid', instance: '/v1/x', metadata: { a: 1 } };

  test.each([
    [401, AuthenticationError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [409, ConflictError],
    [429, RateLimitError],
    [400, ValidationError],
    [500, ServerError],
    [503, ServerError],
  ] as const)('maps %d to the right class', (status, Klass) => {
    const error = make(status, base);
    expect(error).toBeInstanceOf(Klass);
    expect(error.status).toBe(status);
    expect(error.code).toBe('x.y');
    expect(error.correlationId).toBe('cid');
    expect(error.instance).toBe('/v1/x');
    expect(error.metadata).toEqual({ a: 1 });
    expect(error).toBeInstanceOf(TimeManagerError);
  });

  test('maps 422 and other unlisted 4xx to the generic error', () => {
    for (const status of [413, 422]) {
      const error = make(status, base);
      expect(error).toBeInstanceOf(TimeManagerError);
      expect(error).not.toBeInstanceOf(ValidationError);
      expect(error.status).toBe(status);
    }
  });

  test('every ErrorCodes value is dotted lowercase', () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(code).toMatch(/^[a-z]+(\.[a-z]+)*$/);
    }
    expect(Object.values(ErrorCodes)).toContain('payload.too.large');
  });

  test('keeps validation issues', () => {
    const error = make(400, {
      ...base,
      errors: [{ code: 'required', params: { missingProperty: 'name' }, path: 'body.name' }],
    });
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { code: 'required', params: { missingProperty: 'name' }, path: 'body.name' },
    ]);
  });

  test('reads retryAfter from the header first, then the body', () => {
    expect((make(429, base, { 'retry-after': '12' }) as RateLimitError).retryAfter).toBe(12);
    expect((make(429, { ...base, retryAfter: 3 }) as RateLimitError).retryAfter).toBe(3);
    expect((make(429, base) as RateLimitError).retryAfter).toBeNull();
  });

  test('falls back to a default code on a non-problem body', () => {
    const error = make(502, undefined);
    expect(error).toBeInstanceOf(ServerError);
    expect(error.code).toBe('internal.unexpected');
  });

  test('NetworkError carries isTimeout', () => {
    expect(new NetworkError({ isTimeout: true }).isTimeout).toBe(true);
    expect(new NetworkError({}).isTimeout).toBe(false);
    expect(new NetworkError({}).status).toBe(0);
  });
});
