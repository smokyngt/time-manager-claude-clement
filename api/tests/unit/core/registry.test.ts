import { describe, expect, it } from 'bun:test';

import { InternalError, ValidationError } from '@/lib/errors/base/core.js';
import { AppError, registerError, Registry } from '@/lib/errors/base/registry.js';
import { registerEvent } from '@/lib/events/base/registry.js';

describe('errors.registry', () => {
  it('exposes code and default status on the factory', () => {
    const Factory = registerError({ code: 'widget.fail.failed', defaultStatus: 500 });
    expect(Factory.code).toBe('widget.fail.failed');
    expect(Factory.defaultStatus).toBe(500);
    expect(Registry.has('widget.fail.failed')).toBe(true);
    expect(Registry.get('widget.fail.failed')?.defaultStatus).toBe(500);
    expect(Registry.has('never.registered')).toBe(false);
  });

  it('keeps core codes and statuses', () => {
    expect(ValidationError.defaultStatus).toBe(400);
    expect(InternalError.code).toBe('internal.unexpected');
  });

  it('wraps a plain error and keeps it as cause', () => {
    const Factory = registerError({ code: 'widget.wrap.failed', defaultStatus: 500 });
    const cause = new Error('boom');
    const error = Factory({ cause, metadata: { id: 'a' } });
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('widget.wrap.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(cause);
    expect(error.metadata).toEqual({ id: 'a' });
  });

  it('returns an AppError cause unchanged', () => {
    const NotFound = registerError({ code: 'widget.not.found', defaultStatus: 404 });
    const Wrapper = registerError({ code: 'widget.get.failed', defaultStatus: 500 });
    const inner = NotFound();
    expect(Wrapper({ cause: inner })).toBe(inner);
  });

  it('wraps an AppError cause when status, message or correlation id is overridden', () => {
    const NotFound = registerError({ code: 'widget.gone', defaultStatus: 404 });
    const Wrapper = registerError({ code: 'widget.read.failed', defaultStatus: 500 });
    const inner = NotFound({ metadata: { a: 1 } });
    const byStatus = Wrapper({ cause: inner, status: 502 });
    expect(byStatus).not.toBe(inner);
    expect(byStatus.status).toBe(502);
    expect(Wrapper({ cause: inner, message: 'x' }).message).toBe('x');
    expect(Wrapper({ cause: inner, correlation_id: 'c' }).correlation_id).toBe('c');
  });

  it('merges cause metadata only on request', () => {
    const NotFound = registerError({ code: 'widget.lost', defaultStatus: 404 });
    const Wrapper = registerError({ code: 'widget.find.failed', defaultStatus: 500 });
    const inner = NotFound({ metadata: { a: 1, b: 2 } });
    const merged = Wrapper({
      cause: inner,
      mergeCauseMetadata: true,
      metadata: { b: 3 },
      status: 500,
    });
    expect(merged.metadata).toEqual({ a: 1, b: 3 });
    expect(Wrapper({ cause: inner, metadata: { c: 1 }, status: 500 }).metadata).toEqual({ c: 1 });
  });

  it('sanitizes metadata to JSON', () => {
    const Factory = registerError({ code: 'widget.json.failed', defaultStatus: 500 });
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    const error = Factory({
      metadata: { big: 10n, fn: () => 1, loop, nothing: undefined, when: new Error('e') },
    });
    expect(error.metadata['big']).toBe('10');
    expect('fn' in error.metadata).toBe(false);
    expect(error.metadata['when']).toEqual({ message: 'e', name: 'Error' });
    expect(() => JSON.stringify(error.metadata)).not.toThrow();
  });

  it('carries instance and retry_after', () => {
    const Factory = registerError({ code: 'widget.slow', defaultStatus: 429 });
    const error = Factory({ instance: '/x', retry_after: 7 });
    expect(error.instance).toBe('/x');
    expect(error.retry_after).toBe(7);
  });

  it('allows the same code with the same status and throws on a different status', () => {
    registerError({ code: 'widget.dup', defaultStatus: 409 });
    expect(() => registerError({ code: 'widget.dup', defaultStatus: 409 })).not.toThrow();
    expect(() => registerError({ code: 'widget.dup', defaultStatus: 500 })).toThrow();
  });
});

describe('events.registry', () => {
  it('builds typed events', () => {
    const Created = registerEvent<{ id: string }>({ code: 'widget.created' });
    expect(Created.code).toBe('widget.created');
    expect(Created({ payload: { id: 'a' } })).toEqual({
      code: 'widget.created',
      metadata: {},
      payload: { id: 'a' },
    });
    expect(Created({ metadata: { x: 1 }, payload: { id: 'a' } }).metadata).toEqual({ x: 1 });
  });
});
