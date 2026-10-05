import { beforeEach, describe, expect, it } from 'bun:test';

import { Dek } from '@/services/encryption/envelope/dek.js';
import { rotateDEK, rotateTransitKEK } from '@/services/encryption/envelope/rotate.js';

import { conflict, Fixture } from './support.js';

beforeEach(() => {
  Dek.clear();
});

describe('rotateDEK', () => {
  it('inserts v+1 as active and demotes every other version', async () => {
    const fixture = new Fixture();
    const current = await fixture.row('pii', 4);
    fixture.db.enqueue([current], [], []);
    const version = await rotateDEK(fixture.runtime, 'pii');
    expect(version).toBe(5);
    expect(fixture.db.transactions).toBe(1);
    const values = fixture.db.arg('insert', 'values') as Record<string, unknown>;
    expect(values['version']).toBe(5);
    expect(values['status']).toBe('active');
    expect(fixture.db.arg('update', 'set')).toEqual({ status: 'decrypt-only' });
    expect(fixture.infos.join('\n')).toContain('rotated dek domain=pii version=5');
  });

  it('starts at version 1 when the domain has no keys', async () => {
    const fixture = new Fixture();
    fixture.vault.keys.set('time-manager-pii-kek', 1);
    fixture.db.enqueue([], [], []);
    expect(await rotateDEK(fixture.runtime, 'pii')).toBe(1);
  });

  it('reports a concurrent rotation when v+1 already exists', async () => {
    const fixture = new Fixture();
    const current = await fixture.row('pii', 1);
    fixture.db.enqueue([current], conflict());
    const error = (await rotateDEK(fixture.runtime, 'pii').catch((caught: unknown) => caught)) as {
      code: string;
      message: string;
      status: number;
    };
    expect(error.message).toBe('Concurrent rotation detected');
    expect(error.code).toBe('encryption.rotation.conflict');
    expect(error.status).toBe(409);
  });

  it('drops cached active versions so readers pick up the new key', async () => {
    const fixture = new Fixture();
    const first = await fixture.row('pii', 1);
    fixture.db.enqueue([first], [first]);
    expect((await Dek.read(fixture.runtime, 'pii')).version).toBe(1);
    const second = await fixture.row('pii', 2);
    fixture.db.enqueue([first], [], [], [second], [second]);
    await rotateDEK(fixture.runtime, 'pii');
    expect((await Dek.read(fixture.runtime, 'pii')).version).toBe(2);
  });
});

describe('rotateTransitKEK', () => {
  it('rotates the KEK and rewraps every DEK version', async () => {
    const fixture = new Fixture();
    const rows = [
      await fixture.row('pii', 1, 'decrypt-only'),
      await fixture.row('pii', 2, 'active'),
    ];
    fixture.db.enqueue(rows, [], []);
    const result = await rotateTransitKEK(fixture.runtime, 'pii');
    expect(result).toEqual({ failed: [], rewrapped: [1, 2] });
    expect(fixture.vault.keys.get('time-manager-pii-kek')).toBe(2);
    expect(fixture.vault.count('transit/keys/time-manager-pii-kek/rotate')).toBe(1);
    expect(fixture.vault.count('transit/rewrap/')).toBe(2);
    const updates = fixture.db.calls.filter((call) => call.op === 'update' && call.method === 'set');
    expect(updates).toHaveLength(2);
    for (const update of updates) {
      expect(String((update.args[0] as Record<string, unknown>)['wrapped_key'])).toStartWith('vault:v2:');
    }
  });

  it('logs a failing version and continues with the rest', async () => {
    const fixture = new Fixture();
    const rows = [
      await fixture.row('pii', 1, 'decrypt-only'),
      await fixture.row('pii', 2, 'decrypt-only'),
      await fixture.row('pii', 3, 'active'),
    ];
    fixture.vault.failures.add(rows[1]!.wrapped_key);
    fixture.db.enqueue(rows, [], []);
    const result = await rotateTransitKEK(fixture.runtime, 'pii');
    expect(result).toEqual({ failed: [2], rewrapped: [1, 3] });
    expect(fixture.db.calls.filter((call) => call.op === 'update' && call.method === 'set')).toHaveLength(2);
    expect(fixture.errors).toEqual(['[ENVELOPE] rewrap failed domain=pii version=2']);
    expect(fixture.errors.join('')).not.toContain('vault:');
  });

  it('records a database failure on one version without aborting', async () => {
    const fixture = new Fixture();
    const rows = [await fixture.row('hash', 1, 'decrypt-only'), await fixture.row('hash', 2)];
    fixture.db.enqueue(rows, new Error('write failed'), []);
    const result = await rotateTransitKEK(fixture.runtime, 'hash');
    expect(result).toEqual({ failed: [1], rewrapped: [2] });
  });
});
