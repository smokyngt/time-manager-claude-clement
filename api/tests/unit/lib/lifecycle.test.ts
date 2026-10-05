import { describe, expect, it, mock } from 'bun:test';

import { Lifecycle } from '@/lib/lifecycle/index.js';

import type { Runtime } from '@/lib/lifecycle/index.js';

const makeApp = (order: string[], close: () => Promise<unknown>) => ({
  close: async () => {
    order.push('app.close');
    return close();
  },
  log: {
    error: mock(() => undefined),
    fatal: mock(() => undefined),
    info: mock(() => undefined),
  },
});

const makeSql = (order: string[], fail = false) => ({
  end: async () => {
    order.push('sql.end');
    if (fail) throw new Error('boom');
  },
});

describe('Lifecycle.stop', () => {
  it('closes the server before the database and returns 0', async () => {
    const order: string[] = [];
    const code = await Lifecycle.stop(
      makeApp(order, async () => undefined),
      makeSql(order),
      'SIGTERM',
    );
    expect(order).toEqual(['app.close', 'sql.end']);
    expect(code).toBe(0);
  });

  it('still closes the database and returns 1 when the server close fails', async () => {
    const order: string[] = [];
    const code = await Lifecycle.stop(
      makeApp(order, () => Promise.reject(new Error('x'))),
      makeSql(order),
      'SIGINT',
    );
    expect(order).toEqual(['app.close', 'sql.end']);
    expect(code).toBe(1);
  });

  it('returns 1 when the database close fails', async () => {
    const order: string[] = [];
    const code = await Lifecycle.stop(
      makeApp(order, async () => undefined),
      makeSql(order, true),
      'SIGTERM',
    );
    expect(code).toBe(1);
  });

  it('gives up on a hung server close after the drain timeout', async () => {
    const original = Lifecycle.drain;
    Object.defineProperty(Lifecycle, 'drain', { value: 20, writable: true });
    const order: string[] = [];
    const code = await Lifecycle.stop(
      makeApp(order, () => new Promise(() => undefined)),
      makeSql(order),
      'SIGTERM',
    );
    Object.defineProperty(Lifecycle, 'drain', { value: original, writable: true });
    expect(order).toEqual(['app.close', 'sql.end']);
    expect(code).toBe(1);
  });
});

describe('Lifecycle.shutdown', () => {
  const makeRuntime = () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const exit = mock((_code?: number) => undefined);
    const runtime = {
      exit,
      on: (event: string, listener: (...args: unknown[]) => void) => {
        handlers.set(event, listener);
        return runtime;
      },
    } as unknown as Runtime;
    return { exit, handlers, runtime };
  };

  it('registers the four process handlers', () => {
    const { handlers, runtime } = makeRuntime();
    Lifecycle.shutdown(makeApp([], async () => undefined), makeSql([]), runtime);
    expect([...handlers.keys()].sort()).toEqual([
      'SIGINT',
      'SIGTERM',
      'uncaughtException',
      'unhandledRejection',
    ]);
  });

  it('exits with the stop code once, ignoring repeated signals', async () => {
    const { exit, handlers, runtime } = makeRuntime();
    const order: string[] = [];
    Lifecycle.shutdown(makeApp(order, async () => undefined), makeSql(order), runtime);
    handlers.get('SIGTERM')?.();
    handlers.get('SIGINT')?.();
    await Bun.sleep(20);
    expect(order).toEqual(['app.close', 'sql.end']);
    expect(exit.mock.calls).toEqual([[0]]);
  });

  it('logs and exits 1 on unhandled rejection and uncaught exception', () => {
    const { exit, handlers, runtime } = makeRuntime();
    const app = makeApp([], async () => undefined);
    Lifecycle.shutdown(app, makeSql([]), runtime);
    handlers.get('unhandledRejection')?.(new Error('a'));
    handlers.get('uncaughtException')?.(new Error('b'));
    expect(app.log.fatal).toHaveBeenCalledTimes(2);
    expect(exit.mock.calls).toEqual([[1], [1]]);
  });
});
