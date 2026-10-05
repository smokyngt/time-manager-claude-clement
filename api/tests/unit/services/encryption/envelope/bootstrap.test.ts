import { beforeEach, describe, expect, it } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';
import { bootstrap } from '@/services/encryption/envelope/bootstrap.js';
import { Dek } from '@/services/encryption/envelope/dek.js';
import { ensureTransitKey, transitKeyName } from '@/services/encryption/envelope/index.js';

import { conflict, Fixture } from './support.js';

beforeEach(() => {
  Dek.clear();
});

describe('transitKeyName', () => {
  it('derives the KEK name from the domain', () => {
    expect(transitKeyName('pii')).toBe('time-manager-pii-kek');
    expect(transitKeyName('hash')).toBe('time-manager-hash-kek');
  });
});

describe('ensureTransitKey', () => {
  it('creates a non-exportable non-deletable aes256-gcm96 key only when missing', async () => {
    const fixture = new Fixture();
    expect(await ensureTransitKey(fixture.vault, 'time-manager-pii-kek')).toBe(true);
    expect(await ensureTransitKey(fixture.vault, 'time-manager-pii-kek')).toBe(false);
    const writes = fixture.vault.calls.filter((call) => call.data !== undefined);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.data).toEqual({
      deletion_allowed: false,
      exportable: false,
      type: 'aes256-gcm96',
    });
  });

  it('rethrows read failures that are not a missing key', async () => {
    const client = {
      read: (): Promise<undefined> => Promise.reject(Object.assign(new Error('denied'), { status: 403 })),
      write: () => Promise.resolve(undefined),
    };
    expect(ensureTransitKey(client, 'k')).rejects.toThrow('denied');
  });
});

describe('bootstrap', () => {
  it('generates, wraps and stores version 1', async () => {
    const fixture = new Fixture();
    const stored = await fixture.row('pii', 1);
    fixture.vault.keys.clear();
    fixture.db.enqueue([], [stored]);
    const row = await bootstrap(fixture.runtime, 'pii');
    expect(row.version).toBe(1);
    const values = fixture.db.arg('insert', 'values') as Record<string, unknown>;
    expect(values['domain']).toBe('pii');
    expect(values['version']).toBe(1);
    expect(values['status']).toBe('active');
    expect(String(values['wrapped_key'])).toStartWith('vault:v1:');
    expect(fixture.vault.keys.has('time-manager-pii-kek')).toBe(true);
    expect(fixture.infos.join('\n')).toContain('[ENVELOPE] bootstrapped domain=pii version=1');
  });

  it('returns the existing active key without inserting', async () => {
    const fixture = new Fixture();
    const existing = await fixture.row('content', 3);
    fixture.db.enqueue([existing]);
    const row = await bootstrap(fixture.runtime, 'content');
    expect(row.version).toBe(3);
    expect(fixture.db.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('shares one in-process run between concurrent callers', async () => {
    const fixture = new Fixture();
    const stored = await fixture.row('hash', 1);
    fixture.db.enqueue([], [stored]);
    const [first, second] = await Promise.all([
      bootstrap(fixture.runtime, 'hash'),
      bootstrap(fixture.runtime, 'hash'),
    ]);
    expect(first).toBe(second);
    expect(fixture.db.calls.filter((call) => call.op === 'insert' && call.method === 'values')).toHaveLength(1);
    expect(fixture.vault.count('transit/encrypt/')).toBe(2);
  });

  it('re-reads the winner when another replica inserts first (23505)', async () => {
    const winnerSide = new Fixture();
    const winner = await winnerSide.row('pii', 1);
    const loser = new Fixture();
    loser.vault.keys.set('time-manager-pii-kek', 1);
    loser.db.enqueue([], conflict(), [winner]);
    const row = await bootstrap(loser.runtime, 'pii');
    expect(row.id).toBe(winner.id);
    expect(loser.infos.join('\n')).toContain('lost race domain=pii version=1');
  });

  it('unwraps drizzle-style wrapped conflicts through the cause chain', async () => {
    const fixture = new Fixture();
    const winner = await fixture.row('pii', 1);
    fixture.db.enqueue([], new Error('Failed query', { cause: conflict() }), [winner]);
    expect((await bootstrap(fixture.runtime, 'pii')).id).toBe(winner.id);
  });

  it('maps other failures to encryption.key.unavailable without leaking key material', async () => {
    const fixture = new Fixture();
    fixture.vault.keys.set('time-manager-pii-kek', 1);
    fixture.db.enqueue([], new Error('connection reset'));
    const error = await bootstrap(fixture.runtime, 'pii').catch((caught: unknown) => caught);
    expect(AppError.is(error)).toBe(true);
    expect((error as AppError).code).toBe('encryption.key.unavailable');
    expect((error as AppError).status).toBe(503);
    expect(JSON.stringify((error as AppError).metadata)).not.toContain('vault:');
  });
});
