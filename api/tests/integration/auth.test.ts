import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq, isNotNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens, users } from '@/db/schema/index.js';
import { Digest } from '@/utils/crypto/digest.js';

import { Harness } from './setup.js';

import type { CallResult, ErrorBody } from './setup.js';

describe('auth', () => {
  beforeAll(async () => {
    await Harness.start();
  });

  beforeEach(async () => {
    await Harness.reset();
  });

  afterAll(async () => {
    await Harness.stop();
  });

  describe('login', () => {
    test('returns an access token and sets the refresh cookie', async () => {
      const row = await Harness.user({ email: 'login@example.com' });
      const result: CallResult<{ data: Record<string, unknown>; event: { code: string } }> =
        await Harness.call('POST', '/v1/auth/login', {
          body: { email: 'LOGIN@example.com', password: Harness.password },
        });
      expect(result.status).toBe(200);
      expect(result.body.event.code).toBe('auth.logged_in');
      expect(result.body.data.token_type).toBe('Bearer');
      expect(typeof result.body.data.access_token).toBe('string');
      expect((result.body.data.user as { id: string }).id).toBe(row.id);
      expect(result.cookies.tm_refresh).toBeDefined();
    });

    test('stores the email sealed with its hash and never returns either', async () => {
      const row = await Harness.user({ email: 'Sealed@Example.com' });
      const [stored] = await db.select().from(users).where(eq(users.id, row.id));
      expect(stored?.email).not.toContain('sealed@example.com');
      expect(stored?.email).toStartWith('v1.');
      expect(stored?.first_name).not.toBe('Jane');
      expect(stored?.email_hash).toBe(Digest.email('sealed@example.com'));
      const login = await Harness.call<{ data: { user: Record<string, unknown> } }>(
        'POST',
        '/v1/auth/login',
        { body: { email: 'SEALED@example.com', password: Harness.password } },
      );
      expect(login.status).toBe(200);
      expect(login.body.data.user['email']).toBe('sealed@example.com');
      expect(login.body.data.user['first_name']).toBe('Jane');
      expect(login.body.data.user).not.toHaveProperty('email_hash');
      expect(login.body.data.user).not.toHaveProperty('password_hash');
    });

    test('rejects a wrong password', async () => {
      await Harness.user({ email: 'login@example.com' });
      const result = await Harness.call<ErrorBody>('POST', '/v1/auth/login', {
        body: { email: 'login@example.com', password: 'not-the-password' },
      });
      expect(result.status).toBe(401);
      expect(result.body.code).toBe('auth.credentials.invalid');
      expect(result.cookies.tm_refresh).toBeUndefined();
    });

    test('rejects an unknown email with the same error', async () => {
      const result = await Harness.call<ErrorBody>('POST', '/v1/auth/login', {
        body: { email: 'ghost@example.com', password: Harness.password },
      });
      expect(result.status).toBe(401);
      expect(result.body.code).toBe('auth.credentials.invalid');
    });

    test('rejects an archived user', async () => {
      await Harness.user({ archived_at: Date.now(), email: 'gone@example.com' });
      const result = await Harness.call<ErrorBody>('POST', '/v1/auth/login', {
        body: { email: 'gone@example.com', password: Harness.password },
      });
      expect(result.status).toBe(401);
    });

    test('rejects an invalid body', async () => {
      const result = await Harness.call<ErrorBody>('POST', '/v1/auth/login', {
        body: { email: 'not-an-email', password: 'x' },
      });
      expect(result.status).toBe(400);
      expect(result.body.code).toBe('validation.error');
    });
  });

  describe('me', () => {
    test('returns the current user', async () => {
      const member = await Harness.member('manager');
      const result = await Harness.call<{
        data: { scopes: string[]; user: { email: string; role: string } };
      }>('GET', '/v1/auth/me', { token: member.access_token });
      expect(result.status).toBe(200);
      expect(result.body.data.user.email).toBe(member.row.email);
      expect(result.body.data.user.role).toBe('manager');
      expect(result.body.data.scopes).toContain('teams:manage');
    });

    test('requires a token', async () => {
      const result = await Harness.call<ErrorBody>('GET', '/v1/auth/me');
      expect(result.status).toBe(401);
      expect(result.body.code).toBe('token.authentication.failed');
    });

    test('rejects a garbage token', async () => {
      const result = await Harness.call<ErrorBody>('GET', '/v1/auth/me', { token: 'garbage' });
      expect(result.status).toBe(401);
    });
  });

  describe('refresh', () => {
    test('rotates the refresh token and returns a working access token', async () => {
      const member = await Harness.member('employee');
      const result = await Harness.call<{ data: { access_token: string } }>(
        'POST',
        '/v1/auth/refresh',
        { cookie: member.refresh },
      );
      expect(result.status).toBe(200);
      expect(result.cookies.tm_refresh).toBeDefined();
      expect(result.cookies.tm_refresh).not.toBe(member.refresh);
      const me = await Harness.call('GET', '/v1/auth/me', { token: result.body.data.access_token });
      expect(me.status).toBe(200);
    });

    test('rejects a missing cookie', async () => {
      const result = await Harness.call<ErrorBody>('POST', '/v1/auth/refresh');
      expect(result.status).toBe(401);
      expect(result.body.code).toBe('auth.refresh.invalid');
    });

    test('rejects an unknown token', async () => {
      const result = await Harness.call<ErrorBody>('POST', '/v1/auth/refresh', {
        cookie: 'unknown-token',
      });
      expect(result.status).toBe(401);
    });

    test('revokes the whole family when a rotated token is reused', async () => {
      const member = await Harness.member('employee');
      const first = await Harness.call('POST', '/v1/auth/refresh', { cookie: member.refresh });
      const rotated = first.cookies.tm_refresh;
      expect(first.status).toBe(200);
      expect(rotated).toBeDefined();
      await db
        .update(refreshTokens)
        .set({ revoked_at: Date.now() - 60_000 })
        .where(isNotNull(refreshTokens.revoked_at));
      const replay = await Harness.call<ErrorBody>('POST', '/v1/auth/refresh', {
        cookie: member.refresh,
      });
      expect(replay.status).toBe(401);
      expect(replay.body.code).toBe('auth.refresh.invalid');
      const descendant = await Harness.call<ErrorBody>('POST', '/v1/auth/refresh', {
        cookie: rotated,
      });
      expect(descendant.status).toBe(401);
    });

    test('accepts a replay inside the grace window', async () => {
      const member = await Harness.member('employee');
      const first = await Harness.call('POST', '/v1/auth/refresh', { cookie: member.refresh });
      const replay = await Harness.call('POST', '/v1/auth/refresh', { cookie: member.refresh });
      expect(first.status).toBe(200);
      expect(replay.status).toBe(200);
    });

    test('keeps other sessions of the same user alive after a reuse', async () => {
      const member = await Harness.member('employee', { email: 'multi@example.com' });
      const other = await Harness.login(member.credentials);
      await Harness.call('POST', '/v1/auth/refresh', { cookie: member.refresh });
      await db
        .update(refreshTokens)
        .set({ revoked_at: Date.now() - 60_000 })
        .where(isNotNull(refreshTokens.revoked_at));
      await Harness.call('POST', '/v1/auth/refresh', { cookie: member.refresh });
      const result = await Harness.call('POST', '/v1/auth/refresh', { cookie: other.refresh });
      expect(result.status).toBe(200);
    });

    test('rejects the refresh of an archived user', async () => {
      const member = await Harness.member('employee');
      const admin = await Harness.member('admin');
      const archived = await Harness.call('POST', `/v1/users/${member.row.id}/archive`, {
        token: admin.access_token,
      });
      expect(archived.status).toBe(200);
      const result = await Harness.call<ErrorBody>('POST', '/v1/auth/refresh', {
        cookie: member.refresh,
      });
      expect(result.status).toBe(401);
    });
  });

  describe('logout', () => {
    test('revokes the refresh token family', async () => {
      const member = await Harness.member('employee');
      const result = await Harness.call<{ data: { success: boolean } }>('POST', '/v1/auth/logout', {
        cookie: member.refresh,
        token: member.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.success).toBe(true);
      const refreshed = await Harness.call<ErrorBody>('POST', '/v1/auth/refresh', {
        cookie: member.refresh,
      });
      expect(refreshed.status).toBe(401);
    });

    test('answers 200 without any cookie', async () => {
      const result = await Harness.call<{ data: { success: boolean } }>('POST', '/v1/auth/logout');
      expect(result.status).toBe(200);
    });

    test('does not revoke the session of another user', async () => {
      const first = await Harness.member('employee');
      const second = await Harness.member('employee');
      await Harness.call('POST', '/v1/auth/logout', { cookie: first.refresh });
      const result = await Harness.call('POST', '/v1/auth/refresh', { cookie: second.refresh });
      expect(result.status).toBe(200);
    });
  });
});
