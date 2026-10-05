import { fastifyRequestContext } from '@fastify/request-context';
import { afterAll, afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import Fastify from 'fastify';

import { LogCreateError } from '@/lib/errors/index.js';

import { actorOf } from '../user/support.js';

const realLog = { ...(await import('@/services/log/index.js')) };
const create = mock(() => Promise.resolve({ success: true }));
await mock.module('@/services/log/index.js', () => ({ ...realLog, logService: { create } }));

afterAll(() => {
  void mock.module('@/services/log/index.js', () => realLog);
});

afterEach(() => {
  mock.clearAllMocks();
});

const { Audit } = await import('@/services/log/audit.js');

const params = { actor: actorOf('manager'), event: 'user.created', metadata: { user_id: 'u1' } };

describe('log.audit.record', () => {
  it('stores the entry through the log service', async () => {
    await Audit.record(params);
    expect(create).toHaveBeenCalledWith(params);
  });

  it('swallows a failure and writes a warning with ids only outside a request', async () => {
    create.mockRejectedValueOnce(LogCreateError({ metadata: { route: 'log.service.create' } }));
    const write = spyOn(process.stderr, 'write').mockImplementation(() => true);
    await Audit.record(params);
    const line = JSON.parse(String(write.mock.calls[0]?.[0])) as Record<string, unknown>;
    write.mockRestore();
    expect(line).toEqual({
      actor_id: params.actor.id,
      cause: 'log.create.failed',
      event: 'user.created',
      level: 'warn',
      msg: 'audit log failed',
    });
  });

  it('logs the warning on the request logger and keeps the response successful', async () => {
    const warn = mock(() => undefined);
    const app = Fastify();
    await app.register(fastifyRequestContext);
    app.addHook('onRequest', (req, _reply, next) => {
      req.requestContext.set('log', { warn } as unknown as typeof req.log);
      next();
    });
    app.get('/audit', async () => {
      await Audit.record(params);

      return { ok: true };
    });
    create.mockRejectedValueOnce(new Error('db down'));
    const response = await app.inject({ url: '/audit' });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      { actor_id: params.actor.id, cause: 'unknown', event: 'user.created' },
      'audit log failed',
    );
  });
});
