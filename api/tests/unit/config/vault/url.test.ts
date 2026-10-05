import { afterEach, describe, expect, it } from 'bun:test';

import { VaultUrl } from '@/config/vault/url.js';

import { environment } from './fixture.js';

const restore = environment();

afterEach(restore);

describe('VaultUrl.resolve', () => {
  it('requires VAULT_URL', () => {
    delete process.env['VAULT_URL'];
    expect(() => VaultUrl.resolve()).toThrow('VAULT_URL is required');
  });

  it('accepts http outside production and strips the path', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['VAULT_URL'] = 'http://127.0.0.1:8200/ui/';
    expect(VaultUrl.resolve()).toBe('http://127.0.0.1:8200');
  });

  it('refuses http in production and accepts https', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['VAULT_URL'] = 'http://vault:8200';
    expect(() => VaultUrl.resolve()).toThrow('https in production');
    process.env['VAULT_URL'] = 'https://vault:8200';
    expect(VaultUrl.resolve()).toBe('https://vault:8200');
  });

  it('rejects invalid urls and schemes', () => {
    process.env['VAULT_URL'] = 'not a url';
    expect(() => VaultUrl.resolve()).toThrow('not a valid URL');
    process.env['VAULT_URL'] = 'ftp://vault';
    expect(() => VaultUrl.resolve()).toThrow('http or https');
  });
});
