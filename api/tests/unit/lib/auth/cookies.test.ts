import { afterEach, describe, expect, it } from 'bun:test';

import { Cookies } from '@/lib/auth/cookies.js';

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
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

  it('is httpOnly, lax and scoped to the auth path unless told otherwise', () => {
    expect(Cookies.options(5)).toMatchObject({
      httpOnly: true,
      maxAge: 5,
      path: '/v1/auth',
      sameSite: 'lax',
    });
    expect(Cookies.options(5, '/v1/auth/microsoft').path).toBe('/v1/auth/microsoft');
  });
});
