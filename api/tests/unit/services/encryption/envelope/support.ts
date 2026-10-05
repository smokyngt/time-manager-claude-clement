import { randomBytes } from 'node:crypto';

import { FakeDb } from '../../../../support/db.js';

import type { EncryptionKeyRow } from '@/db/schema/encryption-key.js';
import type { Runtime, TransitClient, TransitReply } from '@/services/encryption/envelope/index.js';

export type Call = { data: Record<string, unknown> | undefined; path: string };

export class FakeVault implements TransitClient {
  public readonly calls: Call[] = [];
  public readonly failures = new Set<string>();
  public readonly keys = new Map<string, number>();
  private readonly secrets = new Map<string, string>();

  public count(prefix: string): number {
    return this.calls.filter((call) => call.path.startsWith(prefix)).length;
  }

  public read(path: string): Promise<TransitReply | undefined> {
    this.calls.push({ data: undefined, path });
    const name = path.replace('transit/keys/', '');
    if (!this.keys.has(name)) {
      return Promise.reject(Object.assign(new Error('missing'), { status: 404 }));
    }

    return Promise.resolve({ data: { name } });
  }

  public async wrap(key: Buffer): Promise<string> {
    const reply = await this.write('transit/encrypt/time-manager-pii-kek', {
      plaintext: key.toString('base64'),
    });

    return String(reply?.data?.['ciphertext']);
  }

  public async write(path: string, data: Record<string, unknown>): Promise<TransitReply | undefined> {
    this.calls.push({ data, path });
    await Promise.resolve();
    const [, action, name = ''] = path.split('/');
    if (action === 'keys') {
      if (path.endsWith('/rotate')) {
        const key = path.split('/')[2] ?? '';
        this.keys.set(key, (this.keys.get(key) ?? 1) + 1);
      } else if (!this.keys.has(name)) this.keys.set(name, 1);

      return undefined;
    }
    if (action === 'encrypt') {
      const token = `vault:v${this.keys.get(name) ?? 1}:${randomBytes(12).toString('base64')}`;
      this.secrets.set(token, String(data['plaintext']));

      return { data: { ciphertext: token } };
    }
    const ciphertext = String(data['ciphertext']);
    if (this.failures.has(ciphertext)) throw new Error('vault unavailable');
    const secret = this.secrets.get(ciphertext);
    if (secret === undefined) throw new Error('unknown ciphertext');
    if (action === 'decrypt') return { data: { plaintext: secret } };
    const token = `vault:v${this.keys.get(name) ?? 1}:${randomBytes(12).toString('base64')}`;
    this.secrets.set(token, secret);

    return { data: { ciphertext: token } };
  }
}

export class Fixture {
  public readonly db = new FakeDb();
  public readonly errors: string[] = [];
  public readonly infos: string[] = [];
  public readonly vault = new FakeVault();

  public get runtime(): Runtime {
    return {
      client: this.vault,
      db: this.db as unknown as Runtime['db'],
      log: {
        error: (message) => this.errors.push(message),
        info: (message) => this.infos.push(message),
      },
    };
  }

  public async row(
    domain: EncryptionKeyRow['domain'],
    version: number,
    status: EncryptionKeyRow['status'] = 'active',
  ): Promise<EncryptionKeyRow> {
    this.vault.keys.set(`time-manager-${domain}-kek`, 1);
    const wrapped = await this.vault.write(`transit/encrypt/time-manager-${domain}-kek`, {
      plaintext: randomBytes(32).toString('base64'),
    });

    return {
      created_at: Date.now(),
      domain,
      id: crypto.randomUUID(),
      status,
      version,
      wrapped_key: String(wrapped?.data?.['ciphertext']),
    };
  }
}

export const conflict = (): Error => Object.assign(new Error('duplicate key'), { code: '23505' });
