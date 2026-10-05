import { afterEach, describe, expect, it } from 'bun:test';

import {
  DuplicateKeyError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from '@/lib/errors/base/core.js';
import { registerError } from '@/lib/errors/base/registry.js';
import { ErrorHandler } from '@/middlewares/error.js';

import { Fake } from '../../support/fake.js';

type Body = {
  code: string;
  correlation_id: string;
  errors?: { code: string; params: Record<string, unknown>; path: string }[];
  instance: string;
  metadata?: Record<string, unknown>;
  stack?: string;
  status: number;
  timestamp: number;
};

const run = async (error: unknown, url = '/v1/things?secret=1') => {
  const req = Fake.request({ url });
  const reply = Fake.reply();
  await ErrorHandler.handle(error, req, reply);

  return { body: reply.payload as Body, log: req.log, reply };
};

const original = process.env['NODE_ENV'];

afterEach(() => {
  if (original === undefined) delete process.env['NODE_ENV'];
  else process.env['NODE_ENV'] = original;
});

describe('middlewares.error', () => {
  it('maps Ajv failures to validation.error with snake_case params', async () => {
    const error = Object.assign(new Error('bad'), {
      validation: [
        { instancePath: '', keyword: 'required', params: { missingProperty: 'name' } },
        {
          instancePath: '/items/0',
          keyword: 'additionalProperties',
          params: { additionalProperty: 'x', allowedValues: [1] },
        },
      ],
      validationContext: 'body',
    });
    const { body, reply } = await run(error);
    expect(reply.statusCode).toBe(400);
    expect(body.code).toBe('validation.error');
    expect(body.errors).toEqual([
      { code: 'required', params: { missing_property: 'name' }, path: 'body.name' },
      {
        code: 'additionalProperties',
        params: { additional_property: 'x', allowed_values: [1] },
        path: 'body.items.0',
      },
    ]);
  });

  it('maps SyntaxError and fastify JSON errors to json.invalid', async () => {
    expect((await run(new SyntaxError('x'))).body.code).toBe('json.invalid');
    const fastifyError = Object.assign(new Error('x'), { code: 'FST_ERR_CTP_INVALID_JSON_BODY' });
    expect((await run(fastifyError)).body.status).toBe(400);
  });

  it('maps a Postgres 23505 anywhere in the cause chain to duplicate.key', async () => {
    const pg = Object.assign(new Error('dup'), { code: '23505' });
    const wrapped = new Error('query failed', { cause: new Error('mid', { cause: pg }) });
    const { body, reply } = await run(wrapped);
    expect(reply.statusCode).toBe(409);
    expect(body.code).toBe(DuplicateKeyError.code);
    const domain = registerError({ code: 'thing.create.failed', defaultStatus: 500 })({
      cause: wrapped,
    });
    expect((await run(domain)).body.code).toBe('duplicate.key');
  });

  it('uses the AppError code, status, correlation id and instance', async () => {
    const error = NotFoundError({ correlation_id: 'abc', instance: '/custom' });
    const { body, reply } = await run(error);
    expect(reply.statusCode).toBe(404);
    expect(body.code).toBe('route.not.found');
    expect(body.correlation_id).toBe('abc');
    expect(body.instance).toBe('/custom');
  });

  it('maps objects whose code is registered', async () => {
    const plain = await run({ code: 'rate.limit.exceeded' });
    expect(plain.reply.statusCode).toBe(429);
    const custom = await run({ code: 'unauthorized', statusCode: 418 });
    expect(custom.reply.statusCode).toBe(418);
    expect(custom.body.code).toBe(UnauthorizedError.code);
  });

  it('maps everything else to internal.unexpected', async () => {
    const { body, reply } = await run(new Error('boom'));
    expect(reply.statusCode).toBe(500);
    expect(body.code).toBe(InternalError.code);
    expect(await run('text')).toMatchObject({ body: { status: 500 } });
  });

  it('maps body too large and unknown 4xx', async () => {
    expect((await run(Object.assign(new Error('x'), { statusCode: 413 }))).body.code).toBe(
      'payload.too.large',
    );
    expect((await run(Object.assign(new Error('x'), { statusCode: 415 }))).body.code).toBe(
      'validation.error',
    );
  });

  it('builds the problem body without the query string', async () => {
    const { body } = await run(NotFoundError());
    expect(body.instance).toBe('/v1/things');
    expect(body.correlation_id).toBe('req-test');
    expect(typeof body.timestamp).toBe('number');
  });

  it('includes metadata and stack outside production only', async () => {
    process.env['NODE_ENV'] = 'test';
    const dev = await run(new Error('boom'));
    expect(dev.body.metadata).toBeDefined();
    expect(dev.body.stack).toContain('boom');
    process.env['NODE_ENV'] = 'production';
    const prod = await run(new Error('boom'));
    expect('metadata' in prod.body).toBe(false);
    expect('stack' in prod.body).toBe(false);
  });

  it('sets Retry-After', async () => {
    const limited = registerError({ code: 'thing.slow', defaultStatus: 429 })({ retry_after: 12 });
    expect((await run(limited)).reply.headers['retry-after']).toBe('12');
  });

  it('logs warn for 4xx and error for 5xx with the cause chain', async () => {
    const four = await run(NotFoundError());
    expect(four.log.calls[0]?.level).toBe('warn');
    const five = await run(new Error('outer', { cause: new Error('inner') }));
    expect(five.log.calls[0]?.level).toBe('error');
    const entry = five.log.calls[0]?.args[0] as { cause: { message: string }[] };
    expect(entry.cause.map((link) => link.message)).toEqual(['outer', 'inner']);
  });

  it('answers unknown routes through missing', async () => {
    const req = Fake.request({ url: '/nope' });
    const reply = Fake.reply();
    await ErrorHandler.missing(req, reply);
    expect(reply.statusCode).toBe(404);
    expect((reply.payload as Body).code).toBe('route.not.found');
  });
});
