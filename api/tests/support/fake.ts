import type { Scope } from '@/config/auth/scopes.js';
import type { Actor } from '@/types/entities/actor.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type FakeRequestOptions = {
  actor?: Actor;
  body?: unknown;
  headers?: Record<string, string>;
  params?: unknown;
  query?: unknown;
  scopes?: readonly Scope[];
  url?: string;
};

export type LogCall = { args: unknown[]; level: string };

export class Fake {
  /**
   * @route fake.reply
   * @returns {FakeReply & FastifyReply}
   */
  public static reply(): FakeReply & FastifyReply {
    return new FakeReply() as unknown as FakeReply & FastifyReply;
  }

  /**
   * @route fake.request
   * @param {FakeRequestOptions} options
   * @returns {FastifyRequest & { log: FakeLog }}
   */
  public static request(options: FakeRequestOptions = {}): { log: FakeLog } & FastifyRequest {
    const context = new FakeContext();
    if (options.actor !== undefined) context.set('user', options.actor);
    if (options.scopes !== undefined) context.set('scopes', options.scopes);

    return {
      body: options.body,
      headers: options.headers ?? {},
      id: 'req-test',
      ip: '127.0.0.1',
      log: new FakeLog(),
      method: 'POST',
      params: options.params,
      query: options.query,
      requestContext: context,
      url: options.url ?? '/test',
    } as unknown as { log: FakeLog } & FastifyRequest;
  }
}

export class FakeContext {
  private readonly store = new Map<string, unknown>();

  public get(key: string): unknown {
    return this.store.get(key);
  }

  public set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

export class FakeLog {
  public readonly calls: LogCall[] = [];

  public child(): this {
    return this;
  }

  public debug(...args: unknown[]): void {
    this.calls.push({ args, level: 'debug' });
  }

  public error(...args: unknown[]): void {
    this.calls.push({ args, level: 'error' });
  }

  public info(...args: unknown[]): void {
    this.calls.push({ args, level: 'info' });
  }

  public warn(...args: unknown[]): void {
    this.calls.push({ args, level: 'warn' });
  }
}

export class FakeReply {
  public readonly headers: Record<string, string> = {};
  public payload: unknown;
  public sent = false;
  public statusCode = 200;

  public code(status: number): this {
    return this.status(status);
  }

  public header(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;

    return this;
  }

  public send(payload?: unknown): Promise<this> {
    this.payload = payload;
    this.sent = true;

    return Promise.resolve(this);
  }

  public status(status: number): this {
    this.statusCode = status;

    return this;
  }
}
