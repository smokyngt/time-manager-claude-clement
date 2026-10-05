import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { auditLogs, users } from '@/db/schema/index.js';
import { Digest } from '@/utils/crypto/digest.js';

import { Harness, MISSING_ID } from './setup.js';

import type { ErrorBody, Reply } from './setup.js';
import type { User } from '@/types/entities/index.js';

type BulkBody = {
  data: {
    deleted?: string[];
    failed: { code: string; id: string }[];
    success: boolean;
    updated?: string[];
  };
};

type ListBody = {
  data: { items: User[]; more: boolean; next: null | string; total: number };
};

type UserBody = { data: { user: User } };

const newUser = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  email: 'new.user@example.com',
  first_name: 'New',
  last_name: 'User',
  password: 'a-long-enough-password',
  ...overrides,
});

describe('users', () => {
  beforeAll(async () => {
    await Harness.start();
  });

  beforeEach(async () => {
    await Harness.reset();
  });

  afterAll(async () => {
    await Harness.stop();
  });

  describe('create', () => {
    test('lets an admin create an admin, a manager and an employee', async () => {
      const admin = await Harness.member('admin');
      for (const role of ['admin', 'manager', 'employee'] as const) {
        const result = await Harness.call<Reply<{ user: User }>>(
          'POST',
          '/v1/users/new',
          { body: newUser({ email: `${role}@example.com`, role }), token: admin.access_token },
        );
        expect(result.status).toBe(200);
        expect(result.body.event.code).toBe('user.created');
        expect(result.body.event.correlation_id).toBe(result.headers['x-request-id'] as string);
        expect(result.body.data.user.role).toBe(role);
        expect(result.body.data.user.object).toBe('user');
        expect(result.body.data.user.archived_at).toBeNull();
        expect(result.body.data.user).not.toHaveProperty('password_hash');
      }
    });

    test('seals personal data at rest and returns it in clear', async () => {
      const admin = await Harness.member('admin');
      const created = await Harness.call<UserBody>('POST', '/v1/users/new', {
        body: newUser({ phone_number: '+33 6 12 34 56 78' }),
        token: admin.access_token,
      });
      expect(created.body.data.user).toMatchObject({
        email: 'new.user@example.com',
        first_name: 'New',
        last_name: 'User',
        phone_number: '+33 6 12 34 56 78',
      });
      expect(created.body.data.user).not.toHaveProperty('email_hash');
      const [stored] = await db
        .select()
        .from(users)
        .where(eq(users.id, created.body.data.user.id));
      for (const value of [stored?.email, stored?.first_name, stored?.last_name, stored?.phone_number]) {
        expect(value).toStartWith('v1.');
      }
      expect(stored?.email_hash).toBe(Digest.email('new.user@example.com'));
    });

    test('writes an audit log entry with ids only', async () => {
      const admin = await Harness.member('admin');
      const created = await Harness.call<UserBody>('POST', '/v1/users/new', {
        body: newUser(),
        token: admin.access_token,
      });
      const [entry] = await db.select().from(auditLogs).where(eq(auditLogs.event, 'user.created'));
      expect(entry).toMatchObject({
        actor_id: admin.row.id,
        actor_role: 'admin',
        metadata: { role: 'employee', user_id: created.body.data.user.id },
      });
      expect(JSON.stringify(entry)).not.toContain('new.user@example.com');
    });

    test('lets the created user log in', async () => {
      const admin = await Harness.member('admin');
      await Harness.call('POST', '/v1/users/new', { body: newUser(), token: admin.access_token });
      const login = await Harness.login({
        email: 'new.user@example.com',
        password: 'a-long-enough-password',
      });
      expect(login.user.role).toBe('employee');
    });

    test('lets a manager create an employee only', async () => {
      const manager = await Harness.member('manager');
      const employee = await Harness.call('POST', '/v1/users/new', {
        body: newUser(),
        token: manager.access_token,
      });
      expect(employee.status).toBe(200);
      const peer = await Harness.call<ErrorBody>('POST', '/v1/users/new', {
        body: newUser({ email: 'peer@example.com', role: 'manager' }),
        token: manager.access_token,
      });
      expect(peer.status).toBe(403);
      expect(peer.body.code).toBe('unauthorized');
      const admin = await Harness.call<ErrorBody>('POST', '/v1/users/new', {
        body: newUser({ email: 'boss@example.com', role: 'admin' }),
        token: manager.access_token,
      });
      expect(admin.status).toBe(403);
    });

    test('forbids an employee', async () => {
      const employee = await Harness.member('employee');
      const result = await Harness.call<ErrorBody>('POST', '/v1/users/new', {
        body: newUser(),
        token: employee.access_token,
      });
      expect(result.status).toBe(403);
    });

    test('requires authentication', async () => {
      const result = await Harness.call<ErrorBody>('POST', '/v1/users/new', { body: newUser() });
      expect(result.status).toBe(401);
    });

    test('answers 409 on a duplicate email', async () => {
      const admin = await Harness.member('admin');
      await Harness.call('POST', '/v1/users/new', { body: newUser(), token: admin.access_token });
      const result = await Harness.call<ErrorBody>('POST', '/v1/users/new', {
        body: newUser({ email: 'NEW.user@example.com' }),
        token: admin.access_token,
      });
      expect(result.status).toBe(409);
      expect(result.body.code).toBe('duplicate.key');
    });
  });

  describe('validation', () => {
    test('strips an unknown property silently', async () => {
      const admin = await Harness.member('admin');
      const result = await Harness.call<UserBody>('POST', '/v1/users/new', {
        body: newUser({ password_hash: 'x', unexpected: true }),
        token: admin.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.user).not.toHaveProperty('unexpected');
      const [stored] = await db.select().from(users).where(eq(users.id, result.body.data.user.id));
      expect(stored?.password_hash).toStartWith('$argon2id$');
    });

    test('rejects an invalid body with the error envelope', async () => {
      const admin = await Harness.member('admin');
      const result = await Harness.call<ErrorBody>('POST', '/v1/users/new', {
        body: newUser({ email: 'not-an-email' }),
        token: admin.access_token,
      });
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({
        code: 'validation.error',
        instance: '/v1/users/new',
        status: 400,
      });
      expect(result.body.correlation_id).toBe(result.headers['x-request-id'] as string);
      expect(typeof result.body.timestamp).toBe('number');
      expect(result.body).not.toHaveProperty('message');
      expect(result.body).not.toHaveProperty('request_id');
      expect(result.body.errors?.length).toBeGreaterThan(0);
      expect(result.body.errors?.[0]).toMatchObject({ code: 'format', path: 'body.email' });
    });

    test('rejects a missing field and a short password', async () => {
      const admin = await Harness.member('admin');
      const missing = await Harness.call<ErrorBody>('POST', '/v1/users/new', {
        body: { email: 'a@example.com' },
        token: admin.access_token,
      });
      expect(missing.status).toBe(400);
      const short = await Harness.call<ErrorBody>('POST', '/v1/users/new', {
        body: newUser({ password: 'short' }),
        token: admin.access_token,
      });
      expect(short.status).toBe(400);
    });

    test('rejects wrong types on list and an empty update', async () => {
      const admin = await Harness.member('admin');
      const list = await Harness.call<ErrorBody>('POST', '/v1/users/list', {
        body: { limit: 'many', role: 'owner' },
        token: admin.access_token,
      });
      expect(list.status).toBe(400);
      const update = await Harness.call<ErrorBody>('PATCH', '/v1/users', {
        body: { data: { nope: 1 }, ids: [admin.row.id] },
        token: admin.access_token,
      });
      expect(update.status).toBe(400);
    });

    test('rejects malformed JSON with json.invalid', async () => {
      const response = await Harness.app.inject({
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        payload: '{bad',
        url: '/v1/auth/login',
      });
      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorBody>().code).toBe('json.invalid');
    });

    test('answers 404 with the envelope on an unknown route', async () => {
      const result = await Harness.call<ErrorBody>('GET', '/v1/nothing-here');
      expect(result.status).toBe(404);
      expect(result.body).toMatchObject({ code: 'route.not.found', instance: '/v1/nothing-here', status: 404 });
    });
  });

  describe('list', () => {
    test('paginates with a cursor without overlap', async () => {
      const admin = await Harness.member('admin');
      for (let index = 0; index < 6; index += 1) await Harness.user();
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      let total = 0;
      do {
        const result = await Harness.call<ListBody>('POST', '/v1/users/list', {
          body: { cursor, limit: 3, order: 'asc' },
          token: admin.access_token,
        });
        expect(result.status).toBe(200);
        expect(result.body.data.items.length).toBeLessThanOrEqual(3);
        seen.push(...result.body.data.items.map((item) => item.id));
        total = result.body.data.total;
        cursor = result.body.data.next ?? undefined;
        expect(result.body.data.more).toBe(cursor !== undefined);
        pages += 1;
      } while (cursor !== undefined && pages < 10);
      expect(total).toBe(7);
      expect(pages).toBe(3);
      expect(seen.length).toBe(7);
      expect(new Set(seen).size).toBe(7);
    });

    test('orders descending by default and filters by role', async () => {
      const admin = await Harness.member('admin');
      await Harness.user({ role: 'manager' });
      await Harness.user({ role: 'employee' });
      const all = await Harness.call<ListBody>('POST', '/v1/users/list', {
        body: {},
        token: admin.access_token,
      });
      const times = all.body.data.items.map((item) => item.created_at);
      expect([...times].sort((left, right) => right - left)).toEqual(times);
      const managers = await Harness.call<ListBody>('POST', '/v1/users/list', {
        body: { role: 'manager' },
        token: admin.access_token,
      });
      expect(managers.body.data.total).toBe(1);
    });

    test('filters archived users', async () => {
      const admin = await Harness.member('admin');
      await Harness.user({ archived_at: Date.now() });
      const archived = await Harness.call<ListBody>('POST', '/v1/users/list', {
        body: { archived: true },
        token: admin.access_token,
      });
      expect(archived.body.data.total).toBe(1);
      const active = await Harness.call<ListBody>('POST', '/v1/users/list', {
        body: { archived: false },
        token: admin.access_token,
      });
      expect(active.body.data.total).toBe(1);
    });

    test('shows a manager employees only', async () => {
      const manager = await Harness.member('manager');
      await Harness.user({ role: 'employee' });
      await Harness.user({ role: 'admin' });
      const result = await Harness.call<ListBody>('POST', '/v1/users/list', {
        body: {},
        token: manager.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.items.every((item) => item.role === 'employee')).toBe(true);
      const forbidden = await Harness.call<ErrorBody>('POST', '/v1/users/list', {
        body: { role: 'admin' },
        token: manager.access_token,
      });
      expect(forbidden.status).toBe(403);
    });

    test('forbids an employee and rejects a bad cursor', async () => {
      const employee = await Harness.member('employee');
      const forbidden = await Harness.call<ErrorBody>('POST', '/v1/users/list', {
        body: {},
        token: employee.access_token,
      });
      expect(forbidden.status).toBe(403);
      const admin = await Harness.member('admin');
      const bad = await Harness.call<ErrorBody>('POST', '/v1/users/list', {
        body: { cursor: '!!!' },
        token: admin.access_token,
      });
      expect(bad.status).toBe(400);
    });
  });

  describe('retrieve', () => {
    test('returns a user to an admin and the employee itself', async () => {
      const admin = await Harness.member('admin');
      const employee = await Harness.member('employee');
      const asAdmin = await Harness.call<UserBody>('GET', `/v1/users/${employee.row.id}`, {
        token: admin.access_token,
      });
      expect(asAdmin.status).toBe(200);
      expect(asAdmin.body.data.user.id).toBe(employee.row.id);
      const asSelf = await Harness.call('GET', `/v1/users/${employee.row.id}`, {
        token: employee.access_token,
      });
      expect(asSelf.status).toBe(200);
    });

    test('answers 404 for an unknown id', async () => {
      const admin = await Harness.member('admin');
      const result = await Harness.call<ErrorBody>('GET', `/v1/users/${MISSING_ID}`, {
        token: admin.access_token,
      });
      expect(result.status).toBe(404);
      expect(result.body.code).toBe('user.not.found');
    });

    test('answers 403 when an employee reads someone else', async () => {
      const employee = await Harness.member('employee');
      const other = await Harness.user();
      const result = await Harness.call<ErrorBody>('GET', `/v1/users/${other.id}`, {
        token: employee.access_token,
      });
      expect(result.status).toBe(403);
    });

    test('hides an admin from a manager with a 404 and answers 400 on a bad id', async () => {
      const manager = await Harness.member('manager');
      const admin = await Harness.user({ role: 'admin' });
      const hidden = await Harness.call<ErrorBody>('GET', `/v1/users/${admin.id}`, {
        token: manager.access_token,
      });
      expect(hidden.status).toBe(404);
      expect(hidden.body.code).toBe('user.not.found');
      const bad = await Harness.call<ErrorBody>('GET', '/v1/users/not-a-uuid', {
        token: manager.access_token,
      });
      expect(bad.status).toBe(400);
    });
  });

  describe('update', () => {
    test('updates several users and reports unknown ids as failed', async () => {
      const admin = await Harness.member('admin');
      const first = await Harness.user();
      const second = await Harness.user();
      const result = await Harness.call<BulkBody>('PATCH', '/v1/users', {
        body: { data: { first_name: 'Renamed' }, ids: [first.id, second.id, MISSING_ID] },
        token: admin.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.success).toBe(false);
      expect([...(result.body.data.updated ?? [])].sort()).toEqual([first.id, second.id].sort());
      expect(result.body.data.failed).toEqual([{ code: 'user.not.found', id: MISSING_ID }]);
      const check = await Harness.call<UserBody>('GET', `/v1/users/${first.id}`, {
        token: admin.access_token,
      });
      expect(check.body.data.user.first_name).toBe('Renamed');
      expect(check.body.data.user.updated_at).not.toBeNull();
    });

    test('reports success when every id is updated and dedupes ids', async () => {
      const admin = await Harness.member('admin');
      const target = await Harness.user();
      const result = await Harness.call<BulkBody>('PATCH', '/v1/users', {
        body: { data: { phone_number: '+33 6 12 34 56 78' }, ids: [target.id, target.id] },
        token: admin.access_token,
      });
      expect(result.body.data.success).toBe(true);
      expect(result.body.data.updated).toEqual([target.id]);
    });

    test('lets an admin change a role but not a manager', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const target = await Harness.user();
      const byAdmin = await Harness.call<BulkBody>('PATCH', '/v1/users', {
        body: { data: { role: 'manager' }, ids: [target.id] },
        token: admin.access_token,
      });
      expect(byAdmin.body.data.success).toBe(true);
      const other = await Harness.user();
      const byManager = await Harness.call<ErrorBody>('PATCH', '/v1/users', {
        body: { data: { role: 'manager' }, ids: [other.id] },
        token: manager.access_token,
      });
      expect(byManager.status).toBe(403);
    });

    test('forbids an employee from updating someone else and lets them update themselves', async () => {
      const employee = await Harness.member('employee');
      const other = await Harness.user();
      const denied = await Harness.call<ErrorBody>('PATCH', '/v1/users', {
        body: { data: { first_name: 'X' }, ids: [other.id] },
        token: employee.access_token,
      });
      expect(denied.status).toBe(403);
      const self = await Harness.call<BulkBody>('PATCH', '/v1/users', {
        body: { data: { first_name: 'Me' }, ids: [employee.row.id] },
        token: employee.access_token,
      });
      expect(self.status).toBe(200);
      expect(self.body.data.success).toBe(true);
      const roleSelf = await Harness.call<ErrorBody>('PATCH', '/v1/users', {
        body: { data: { role: 'admin' }, ids: [employee.row.id] },
        token: employee.access_token,
      });
      expect(roleSelf.status).toBe(403);
    });

    test('rejects an empty data object and an empty id list', async () => {
      const admin = await Harness.member('admin');
      const emptyData = await Harness.call<ErrorBody>('PATCH', '/v1/users', {
        body: { data: {}, ids: [admin.row.id] },
        token: admin.access_token,
      });
      expect(emptyData.status).toBe(400);
      const emptyIds = await Harness.call<ErrorBody>('PATCH', '/v1/users', {
        body: { data: { first_name: 'X' }, ids: [] },
        token: admin.access_token,
      });
      expect(emptyIds.status).toBe(400);
    });
  });

  describe('delete', () => {
    test('deletes users and reports unknown ids as failed', async () => {
      const admin = await Harness.member('admin');
      const target = await Harness.user();
      const result = await Harness.call<BulkBody>('DELETE', '/v1/users', {
        body: { ids: [target.id, MISSING_ID] },
        token: admin.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.success).toBe(false);
      expect(result.body.data.deleted).toEqual([target.id]);
      expect(result.body.data.failed).toEqual([{ code: 'user.not.found', id: MISSING_ID }]);
      const check = await Harness.call<ErrorBody>('GET', `/v1/users/${target.id}`, {
        token: admin.access_token,
      });
      expect(check.status).toBe(404);
    });

    test('forbids deleting oneself or as an employee and hides a peer manager', async () => {
      const admin = await Harness.member('admin');
      const self = await Harness.call<ErrorBody>('DELETE', '/v1/users', {
        body: { ids: [admin.row.id] },
        token: admin.access_token,
      });
      expect(self.status).toBe(403);
      const employee = await Harness.member('employee');
      const byEmployee = await Harness.call<ErrorBody>('DELETE', '/v1/users', {
        body: { ids: [employee.row.id] },
        token: employee.access_token,
      });
      expect(byEmployee.status).toBe(403);
      const manager = await Harness.member('manager');
      const peer = await Harness.user({ role: 'manager' });
      const byManager = await Harness.call<BulkBody>('DELETE', '/v1/users', {
        body: { ids: [peer.id] },
        token: manager.access_token,
      });
      expect(byManager.status).toBe(200);
      expect(byManager.body.data.deleted).toEqual([]);
      expect(byManager.body.data.failed).toEqual([{ code: 'user.not.found', id: peer.id }]);
    });
  });

  describe('archive and restore', () => {
    test('archives then restores a user', async () => {
      const admin = await Harness.member('admin');
      const target = await Harness.user();
      const archived = await Harness.call<UserBody>(
        'POST',
        `/v1/users/${target.id}/archive`,
        { token: admin.access_token },
      );
      expect(archived.status).toBe(200);
      expect(archived.body.data.user.archived_at).not.toBeNull();
      const restored = await Harness.call<UserBody>(
        'POST',
        `/v1/users/${target.id}/restore`,
        { token: admin.access_token },
      );
      expect(restored.status).toBe(200);
      expect(restored.body.data.user.archived_at).toBeNull();
    });

    test('blocks login while archived', async () => {
      const admin = await Harness.member('admin');
      const target = await Harness.user({ email: 'sleeper@example.com' });
      await Harness.call('POST', `/v1/users/${target.id}/archive`, { token: admin.access_token });
      const blocked = await Harness.call<ErrorBody>('POST', '/v1/auth/login', {
        body: { email: 'sleeper@example.com', password: Harness.password },
      });
      expect(blocked.status).toBe(401);
      await Harness.call('POST', `/v1/users/${target.id}/restore`, { token: admin.access_token });
      const allowed = await Harness.call('POST', '/v1/auth/login', {
        body: { email: 'sleeper@example.com', password: Harness.password },
      });
      expect(allowed.status).toBe(200);
    });

    test('forbids archiving oneself or as an employee, and answers 404 on unknown ids', async () => {
      const admin = await Harness.member('admin');
      const self = await Harness.call<ErrorBody>('POST', `/v1/users/${admin.row.id}/archive`, {
        token: admin.access_token,
      });
      expect(self.status).toBe(403);
      const employee = await Harness.member('employee');
      const other = await Harness.user();
      const denied = await Harness.call<ErrorBody>('POST', `/v1/users/${other.id}/archive`, {
        token: employee.access_token,
      });
      expect(denied.status).toBe(403);
      const missing = await Harness.call<ErrorBody>('POST', `/v1/users/${MISSING_ID}/restore`, {
        token: admin.access_token,
      });
      expect(missing.status).toBe(404);
    });
  });
});
