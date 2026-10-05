import { afterAll, afterEach, describe, expect, it } from 'bun:test';

import { Config } from '@/config/index.js';

const saved = { ...process.env };
const SECRET_A = 'a'.repeat(40);
const SECRET_B = 'b'.repeat(40);
const SECRET_C = 'c'.repeat(40);
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const HASH_KEY = Buffer.alloc(32, 9).toString('base64');
const TENANT = '11111111-2222-4333-8444-555555555555';

const production = (extra: Record<string, string> = {}): void => {
  process.env = {
    DATABASE_URL: 'postgres://x',
    ENCRYPTION_KEY,
    HASH_KEY,
    JWT_ACCESS_SECRET: SECRET_A,
    JWT_REFRESH_SECRET: SECRET_B,
    NODE_ENV: 'production',
    WEB_URL: 'https://app.example.com',
    ...extra,
  };
};

afterEach(() => {
  process.env = { ...saved };
});

afterAll(() => {
  process.env = saved;
});

describe('Config.validate', () => {
  it('skips checks outside production', () => {
    process.env['NODE_ENV'] = 'development';
    expect(Config.validate()).toEqual([]);
  });

  it('accepts a sound production configuration', () => {
    production();
    expect(Config.validate()).toEqual([]);
  });

  it('rejects placeholder and identical secrets', () => {
    production({ JWT_ACCESS_SECRET: `change-me-${SECRET_A}`, JWT_REFRESH_SECRET: `dev-only-${SECRET_B}` });
    expect(Config.validate()).toHaveLength(2);
    production({ JWT_REFRESH_SECRET: SECRET_A });
    expect(Config.validate()).toEqual(['JWT_REFRESH_SECRET must differ from the other secrets']);
  });

  it('requires a distinct OAUTH_STATE_SECRET and a single tenant when Microsoft is configured', () => {
    const microsoft = {
      MICROSOFT_CLIENT_ID: 'id',
      MICROSOFT_CLIENT_SECRET: 'secret',
      MICROSOFT_REDIRECT_URI: 'https://api.example.com/v1/auth/microsoft/callback',
      MICROSOFT_TENANT_ID: TENANT,
      OAUTH_STATE_SECRET: SECRET_C,
    };
    production(microsoft);
    expect(Config.validate()).toEqual([]);
    production({ ...microsoft, OAUTH_STATE_SECRET: '' });
    expect(Config.validate()).toEqual(['OAUTH_STATE_SECRET must be at least 32 characters']);
    production({ ...microsoft, OAUTH_STATE_SECRET: SECRET_A });
    expect(Config.validate()).toEqual(['OAUTH_STATE_SECRET must differ from the other secrets']);
    for (const alias of ['common', 'organizations', 'consumers', 'Common']) {
      production({ ...microsoft, MICROSOFT_TENANT_ID: alias });
      expect(Config.validate()).toHaveLength(1);
    }
    production({ ...microsoft, MICROSOFT_TENANT_ID: '' });
    expect(Config.validate()).toHaveLength(1);
  });

  it('rejects a tenant that is not a GUID', () => {
    production({
      MICROSOFT_CLIENT_ID: 'id',
      MICROSOFT_CLIENT_SECRET: 'secret',
      MICROSOFT_REDIRECT_URI: 'https://api.example.com/v1/auth/microsoft/callback',
      MICROSOFT_TENANT_ID: 'contoso.onmicrosoft.com',
      OAUTH_STATE_SECRET: SECRET_C,
    });
    expect(Config.validate()).toHaveLength(1);
  });

  it('rejects a placeholder Microsoft client secret', () => {
    production({
      MICROSOFT_CLIENT_ID: 'id',
      MICROSOFT_CLIENT_SECRET: 'CHANGE_ME_secret',
      MICROSOFT_REDIRECT_URI: 'https://api.example.com/v1/auth/microsoft/callback',
      MICROSOFT_TENANT_ID: TENANT,
      OAUTH_STATE_SECRET: SECRET_C,
    });
    expect(Config.validate()).toEqual(['MICROSOFT_CLIENT_SECRET must not be a placeholder value']);
  });

  it('includes the encryption and hash key problems from Keys.validate', () => {
    production({ ENCRYPTION_KEY: '', HASH_KEY: '' });
    expect(Config.validate()).toEqual(['ENCRYPTION_KEY is required', 'HASH_KEY is required']);
    production({ ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') });
    expect(Config.validate()).toEqual(['ENCRYPTION_KEY must decode to exactly 32 bytes']);
  });

  it('rejects an unusable TRUST_PROXY', () => {
    production({ TRUST_PROXY: 'banana' });
    expect(Config.validate()).toHaveLength(1);
    production({ TRUST_PROXY: '10.0.0.0/8,::1' });
    expect(Config.validate()).toEqual([]);
    production({ TRUST_PROXY: '10.0.0.0/40' });
    expect(Config.validate()).toHaveLength(1);
  });

  it('does not require the state secret when Microsoft is off', () => {
    production();
    expect(Config.validate()).toEqual([]);
  });

  it('requires https non-local urls unless explicitly allowed', () => {
    production({ WEB_URL: 'http://localhost:8080' });
    expect(Config.validate()).toEqual(['WEB_URL must be a non-local https url']);
    production({ WEB_URL: 'https://localhost' });
    expect(Config.validate()).toHaveLength(1);
    production({
      MICROSOFT_CLIENT_ID: 'id',
      MICROSOFT_CLIENT_SECRET: 's',
      MICROSOFT_REDIRECT_URI: 'http://api.example.com/cb',
      MICROSOFT_TENANT_ID: TENANT,
      OAUTH_STATE_SECRET: SECRET_C,
    });
    expect(Config.validate()).toEqual(['MICROSOFT_REDIRECT_URI must be a non-local https url']);
    production({ ALLOW_INSECURE_URLS: 'true', WEB_URL: 'http://localhost:8080' });
    expect(Config.validate()).toEqual([]);
  });
});

describe('Config.proxy', () => {
  it('defaults to not trusting anything', () => {
    delete process.env['TRUST_PROXY'];
    expect(Config.proxy()).toBe(false);
  });

  it('parses booleans, hop counts and cidr lists', () => {
    const cases: [string, boolean | number | string[]][] = [
      ['true', true],
      ['false', false],
      ['2', 2],
      ['10.0.0.0/8, 172.16.0.0/12', ['10.0.0.0/8', '172.16.0.0/12']],
      ['127.0.0.1', ['127.0.0.1']],
    ];
    for (const [raw, expected] of cases) {
      process.env['TRUST_PROXY'] = raw;
      expect(Config.proxy()).toEqual(expected);
    }
  });
});

describe('Config accessors', () => {
  it('trims the trailing slash of the web url and defaults the redirect uri', () => {
    process.env['WEB_URL'] = 'https://app.example.com//';
    expect(Config.web()).toBe('https://app.example.com');
    delete process.env['MICROSOFT_REDIRECT_URI'];
    expect(Config.redirect()).toBe('http://localhost:8000/v1/auth/microsoft/callback');
  });

  it('only accepts a GUID tenant', () => {
    process.env['MICROSOFT_TENANT_ID'] = TENANT.toUpperCase();
    expect(Config.tenant()).toBe(TENANT);
    for (const alias of ['common', 'organizations', 'consumers', '']) {
      process.env['MICROSOFT_TENANT_ID'] = alias;
      expect(Config.tenant()).toBeUndefined();
    }
  });
});
