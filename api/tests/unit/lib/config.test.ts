import { afterAll, afterEach, describe, expect, it } from 'bun:test';

import { Config } from '@/config/index.js';
import { Cookies } from '@/lib/auth/cookies.js';
import { Redact } from '@/lib/auth/redact.js';

const saved = { ...process.env };
const SECRET_A = 'a'.repeat(40);
const SECRET_B = 'b'.repeat(40);
const SECRET_C = 'c'.repeat(40);
const TENANT = '11111111-2222-4333-8444-555555555555';

const production = (extra: Record<string, string> = {}): void => {
  process.env = {
    DATABASE_URL: 'postgres://x',
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

describe('Cookies.options', () => {
  it('follows production by default and COOKIE_SECURE when set', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['COOKIE_SECURE'];
    expect(Cookies.options(1).secure).toBe(true);
    process.env['COOKIE_SECURE'] = 'false';
    expect(Cookies.options(1).secure).toBe(false);
    process.env['NODE_ENV'] = 'development';
    process.env['COOKIE_SECURE'] = 'true';
    expect(Cookies.options(1).secure).toBe(true);
    delete process.env['COOKIE_SECURE'];
    expect(Cookies.options(1).secure).toBe(false);
  });
});

describe('Redact.url', () => {
  it('hides oauth code and state but keeps the rest', () => {
    expect(Redact.url('/v1/auth/microsoft/callback?code=abc&state=xyz&other=1')).toBe(
      '/v1/auth/microsoft/callback?code=redacted&state=redacted&other=1',
    );
    expect(Redact.url('/health')).toBe('/health');
    expect(Redact.url(undefined)).toBeUndefined();
  });
});
