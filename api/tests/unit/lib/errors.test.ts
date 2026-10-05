import { describe, expect, it } from 'bun:test';

import { UserNotFoundError } from '@/lib/errors/domains/user.js';
import { ErrorHandler } from '@/lib/errors/handler.js';
import { AppError, InternalError, registerError } from '@/lib/errors/index.js';
import { registerEvent } from '@/lib/events/index.js';

import { makeReply, makeReq } from '../../helpers/fixtures.js';

import type { FastifyReply } from 'fastify';

const DemoError = registerError({ code: 'DEMO', defaultStatus: 418, message: 'Demo.' });

describe('registerError', () => {
  it('exposes code and default status on the factory', () => {
    expect(DemoError.code).toBe('DEMO');
    expect(DemoError.defaultStatus).toBe(418);
    const error = DemoError({ cause: new Error('x'), metadata: { a: 1 } });
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(418);
    expect(error.metadata).toEqual({ a: 1 });
  });

  it('returns the original error when the cause is already an AppError', () => {
    const original = UserNotFoundError();
    expect(DemoError({ cause: original })).toBe(original);
  });
});

describe('registerEvent', () => {
  it('builds typed events', () => {
    const Demo = registerEvent<{ id: string }>('demo.done');
    expect(Demo.code).toBe('demo.done');
    expect(Demo({ payload: { id: '1' } })).toEqual({
      code: 'demo.done',
      metadata: {},
      payload: { id: '1' },
    });
  });
});

describe('ErrorHandler', () => {
  const send = async (error: unknown) => {
    const { fake, reply } = makeReply<FastifyReply>();
    await ErrorHandler.handle(error, makeReq(), reply);
    return fake;
  };

  it('maps AppError to the error envelope', async () => {
    const fake = await send(UserNotFoundError());
    expect(fake.statusCode).toBe(404);
    expect(fake.sent).toEqual({
      code: 'USER_NOT_FOUND',
      message: 'The user does not exist.',
      request_id: 'req-test',
      status: 404,
    });
  });

  it('maps fastify validation errors to 400', async () => {
    const fake = await send(
      Object.assign(new Error('body/email must match format'), {
        validation: [{ instancePath: '/email' }],
      }),
    );
    expect(fake.statusCode).toBe(400);
    expect(fake.sent).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps rate limit errors to 429 and other client errors to 400', async () => {
    expect(
      (await send(Object.assign(new Error('slow down'), { statusCode: 429 }))).statusCode,
    ).toBe(429);
    expect(
      (await send(Object.assign(new Error('bad media'), { statusCode: 415 }))).statusCode,
    ).toBe(400);
  });

  it('never leaks internals of unexpected errors', async () => {
    const fake = await send(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret'));
    expect(fake.statusCode).toBe(500);
    expect(fake.sent).toEqual({
      code: InternalError.code,
      message: 'An unexpected error occurred.',
      request_id: 'req-test',
      status: 500,
    });
  });
});
