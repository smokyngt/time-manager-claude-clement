import { afterEach, describe, expect, it } from 'bun:test';
import { jwtVerify } from 'jose';

import { authorize } from '@/services/auth/authorize.js';

import { caught, TENANT } from './support.js';

const saved = { ...process.env };

const configure = (): void => {
  process.env['MICROSOFT_CLIENT_ID'] = 'client-id';
  process.env['MICROSOFT_CLIENT_SECRET'] = 'client-secret';
  process.env['MICROSOFT_TENANT_ID'] = TENANT;
};

afterEach(() => {
  process.env = { ...saved };
});

describe('auth.service.authorize', () => {
  it('answers unavailable when Microsoft is not configured', async () => {
    const error = await caught(authorize());
    expect(error.code).toBe('auth.microsoft.unavailable');
    expect(error.status).toBe(503);
  });

  it('answers unavailable when the tenant is missing or a multi-tenant alias', async () => {
    configure();
    for (const tenant of [undefined, 'common', 'organizations', 'consumers', 'contoso']) {
      if (tenant === undefined) delete process.env['MICROSOFT_TENANT_ID'];
      else process.env['MICROSOFT_TENANT_ID'] = tenant;
      const error = await caught(authorize());
      expect(error.code).toBe('auth.microsoft.unavailable');
    }
  });

  it('builds an authorization code + PKCE url pinned to the tenant', async () => {
    configure();
    const result = await authorize();
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(
      `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`,
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(result.max_age).toBe(600);
  });

  it('signs the state cookie with OAUTH_STATE_SECRET only', async () => {
    configure();
    process.env['OAUTH_STATE_SECRET'] = 's'.repeat(40);
    const result = await authorize();
    const key = (secret: string): Uint8Array => new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(result.state_cookie, key('s'.repeat(40)), {
      audience: 'oauth-state',
    });
    expect(payload['state']).toBe(new URL(result.url).searchParams.get('state'));
    expect(payload['verifier']).toBeTruthy();
    for (const other of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
      process.env[other] = 'x'.repeat(40);
      const rejected = await jwtVerify(result.state_cookie, key('x'.repeat(40))).catch(
        () => undefined,
      );
      expect(rejected).toBeUndefined();
    }
  });
});
