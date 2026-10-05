import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/index.js';

import { Harness, MISSING_ID } from './setup.js';

import type { ErrorBody, Reply } from './setup.js';
import type { Clock } from '@/types/entities/index.js';

type BulkBody = {
  data: {
    deleted?: string[];
    failed: { code: string; id: string }[];
    success: boolean;
    updated?: string[];
  };
};

type ClockBody = { data: { clock: Clock } };

type CurrentBody = { data: { clock: Clock | null } };

type ListBody = { data: { items: Clock[]; more: boolean; next: null | string; total: number } };

const HOUR = 3_600_000;
const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const hoursAgo = (hours: number): number => Date.now() - hours * HOUR;

describe('clocks', () => {
  beforeAll(async () => {
    await Harness.start();
  });

  beforeEach(async () => {
    await Harness.reset();
  });

  afterAll(async () => {
    await Harness.stop();
  });

  describe('in, out and current', () => {
    test('clocks in, shows the open clock, then clocks out with a sealed note', async () => {
      const employee = await Harness.member('employee');
      const started = await Harness.call<Reply<{ clock: Clock }>>('POST', '/v1/clocks/in', {
        body: { note: 'On site' },
        token: employee.access_token,
      });
      expect(started.status).toBe(200);
      expect(started.body.event.code).toBe('clock.started');
      expect(started.body.data.clock).toMatchObject({
        clocked_out_at: null,
        duration_ms: null,
        note: 'On site',
        object: 'clock',
        source: 'clock',
        user_id: employee.row.id,
      });
      const [stored] = await db
        .select()
        .from(clocks)
        .where(eq(clocks.id, started.body.data.clock.id));
      expect(stored?.note).toStartWith('v1.');
      const current = await Harness.call<CurrentBody>('GET', '/v1/clocks/current', {
        token: employee.access_token,
      });
      expect(current.body.data.clock?.id).toBe(started.body.data.clock.id);
      await wait(10);
      const stopped = await Harness.call<Reply<{ clock: Clock }>>('POST', '/v1/clocks/out', {
        body: {},
        token: employee.access_token,
      });
      expect(stopped.status).toBe(200);
      expect(stopped.body.event.code).toBe('clock.stopped');
      expect(stopped.body.data.clock.clocked_out_at).not.toBeNull();
      expect(stopped.body.data.clock.duration_ms).toBeGreaterThan(0);
      expect(stopped.body.data.clock.note).toBe('On site');
      const after = await Harness.call<CurrentBody>('GET', '/v1/clocks/current', {
        token: employee.access_token,
      });
      expect(after.body.data.clock).toBeNull();
    });

    test('refuses a second clock in and a clock out without an open clock', async () => {
      const employee = await Harness.member('employee');
      const first = await Harness.call('POST', '/v1/clocks/in', {
        body: {},
        token: employee.access_token,
      });
      expect(first.status).toBe(200);
      const second = await Harness.call<ErrorBody>('POST', '/v1/clocks/in', {
        body: {},
        token: employee.access_token,
      });
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('clock.conflict');
      const other = await Harness.member('employee');
      const orphan = await Harness.call<ErrorBody>('POST', '/v1/clocks/out', {
        body: {},
        token: other.access_token,
      });
      expect(orphan.status).toBe(409);
      expect(orphan.body.code).toBe('clock.conflict');
    });

    test('allows only one open clock per user at the database level', async () => {
      const employee = await Harness.user();
      await Harness.clock({ clocked_in_at: hoursAgo(3), user_id: employee.id });
      const second = await Harness.clock({ clocked_in_at: hoursAgo(1), user_id: employee.id }).then(
        () => 'inserted',
        () => 'rejected',
      );
      expect(second).toBe('rejected');
    });

    test('requires authentication and rejects an oversized note', async () => {
      const anonymous = await Harness.call<ErrorBody>('POST', '/v1/clocks/in', { body: {} });
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.code).toBe('token.authentication.failed');
      const employee = await Harness.member('employee');
      const long = await Harness.call<ErrorBody>('POST', '/v1/clocks/in', {
        body: { note: 'x'.repeat(5000) },
        token: employee.access_token,
      });
      expect(long.status).toBe(400);
      expect(long.body.code).toBe('validation.error');
    });
  });

  describe('create', () => {
    test('lets an admin and the manager of the employee record a closed clock', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const employee = await Harness.user();
      await Harness.team({ manager_id: manager.row.id, members: [employee.id] });
      const body = {
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(6),
        note: 'Forgot to clock',
        user_id: employee.id,
      };
      const byManager = await Harness.call<Reply<{ clock: Clock }>>('POST', '/v1/clocks/new', {
        body,
        token: manager.access_token,
      });
      expect(byManager.status).toBe(200);
      expect(byManager.body.event.code).toBe('clock.created');
      expect(byManager.body.data.clock).toMatchObject({
        duration_ms: 4 * HOUR,
        note: 'Forgot to clock',
        source: 'manual',
        user_id: employee.id,
      });
      const byAdmin = await Harness.call<ClockBody>('POST', '/v1/clocks/new', {
        body: { ...body, clocked_in_at: hoursAgo(20), clocked_out_at: hoursAgo(16) },
        token: admin.access_token,
      });
      expect(byAdmin.status).toBe(200);
    });

    test('rejects overlaps, future dates and reversed ranges', async () => {
      const admin = await Harness.member('admin');
      const employee = await Harness.user();
      await Harness.clock({
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(6),
        user_id: employee.id,
      });
      const overlap = await Harness.call<ErrorBody>('POST', '/v1/clocks/new', {
        body: { clocked_in_at: hoursAgo(8), clocked_out_at: hoursAgo(7), user_id: employee.id },
        token: admin.access_token,
      });
      expect(overlap.status).toBe(409);
      expect(overlap.body.code).toBe('clock.overlap');
      const future = await Harness.call<ErrorBody>('POST', '/v1/clocks/new', {
        body: {
          clocked_in_at: Date.now() + HOUR,
          clocked_out_at: Date.now() + 2 * HOUR,
          user_id: employee.id,
        },
        token: admin.access_token,
      });
      expect(future.status).toBe(400);
      expect(future.body.code).toBe('clock.invalid');
      const reversed = await Harness.call<ErrorBody>('POST', '/v1/clocks/new', {
        body: { clocked_in_at: hoursAgo(2), clocked_out_at: hoursAgo(3), user_id: employee.id },
        token: admin.access_token,
      });
      expect(reversed.status).toBe(400);
      expect(reversed.body.code).toBe('clock.invalid');
    });

    test('forbids employees and managers of other teams, and validates the body', async () => {
      const employee = await Harness.member('employee');
      const stranger = await Harness.member('manager');
      const target = await Harness.user();
      const body = {
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(6),
        user_id: target.id,
      };
      const asEmployee = await Harness.call<ErrorBody>('POST', '/v1/clocks/new', {
        body: { ...body, user_id: employee.row.id },
        token: employee.access_token,
      });
      expect(asEmployee.status).toBe(403);
      expect(asEmployee.body.code).toBe('unauthorized');
      const asStranger = await Harness.call<ErrorBody>('POST', '/v1/clocks/new', {
        body,
        token: stranger.access_token,
      });
      expect(asStranger.status).toBe(403);
      const missing = await Harness.call<ErrorBody>('POST', '/v1/clocks/new', {
        body: { user_id: target.id },
        token: stranger.access_token,
      });
      expect(missing.status).toBe(400);
      expect(missing.body.errors?.map((item) => item.path)).toContain('body.clocked_in_at');
    });
  });

  describe('list and retrieve', () => {
    test('shows employees their own clocks, managers their team, admins everyone', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const employee = await Harness.member('employee');
      const outsider = await Harness.member('employee');
      await Harness.team({ manager_id: manager.row.id, members: [employee.row.id] });
      const own = await Harness.clock({
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(6),
        user_id: employee.row.id,
      });
      await Harness.clock({
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(6),
        user_id: outsider.row.id,
      });
      const asEmployee = await Harness.call<ListBody>('POST', '/v1/clocks/list', {
        body: { user_ids: [outsider.row.id] },
        token: employee.access_token,
      });
      expect(asEmployee.body.data.items.map((item) => item.id)).toEqual([own]);
      const asManager = await Harness.call<ListBody>('POST', '/v1/clocks/list', {
        body: {},
        token: manager.access_token,
      });
      expect(asManager.body.data.items.map((item) => item.id)).toEqual([own]);
      const asAdmin = await Harness.call<ListBody>('POST', '/v1/clocks/list', {
        body: {},
        token: admin.access_token,
      });
      expect(asAdmin.body.data.total).toBe(2);
    });

    test('filters by open state and date range and paginates', async () => {
      const employee = await Harness.member('employee');
      for (let index = 1; index <= 4; index += 1) {
        await Harness.clock({
          clocked_in_at: hoursAgo(index * 30),
          clocked_out_at: hoursAgo(index * 30 - 2),
          user_id: employee.row.id,
        });
      }
      await Harness.clock({ clocked_in_at: hoursAgo(1), user_id: employee.row.id });
      const open = await Harness.call<ListBody>('POST', '/v1/clocks/list', {
        body: { open: true },
        token: employee.access_token,
      });
      expect(open.body.data.total).toBe(1);
      const range = await Harness.call<ListBody>('POST', '/v1/clocks/list', {
        body: { from: hoursAgo(70), open: false, to: hoursAgo(10) },
        token: employee.access_token,
      });
      expect(range.body.data.total).toBe(2);
      const first = await Harness.call<ListBody>('POST', '/v1/clocks/list', {
        body: { limit: 2 },
        token: employee.access_token,
      });
      expect(first.body.data.items).toHaveLength(2);
      expect(first.body.data.more).toBe(true);
      const second = await Harness.call<ListBody>('POST', '/v1/clocks/list', {
        body: { cursor: first.body.data.next ?? undefined, limit: 2 },
        token: employee.access_token,
      });
      expect(second.body.data.items).toHaveLength(2);
      const bad = await Harness.call<ErrorBody>('POST', '/v1/clocks/list', {
        body: { from: 'yesterday' },
        token: employee.access_token,
      });
      expect(bad.status).toBe(400);
    });

    test('retrieves own clocks and hides the clocks of others behind a 404', async () => {
      const employee = await Harness.member('employee');
      const other = await Harness.member('employee');
      const own = await Harness.clock({
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(9),
        note: 'Mine',
        user_id: employee.row.id,
      });
      const found = await Harness.call<ClockBody>('GET', `/v1/clocks/${own}`, {
        token: employee.access_token,
      });
      expect(found.status).toBe(200);
      expect(found.body.data.clock).toMatchObject({ id: own, note: 'Mine' });
      const hidden = await Harness.call<ErrorBody>('GET', `/v1/clocks/${own}`, {
        token: other.access_token,
      });
      expect(hidden.status).toBe(404);
      expect(hidden.body.code).toBe('clock.not.found');
      const unknown = await Harness.call<ErrorBody>('GET', `/v1/clocks/${MISSING_ID}`, {
        token: employee.access_token,
      });
      expect(unknown.status).toBe(404);
      const bad = await Harness.call<ErrorBody>('GET', '/v1/clocks/nope', {
        token: employee.access_token,
      });
      expect(bad.status).toBe(400);
    });
  });

  describe('update and delete', () => {
    test('lets a manager correct a clock of a team member and reports unknown ids', async () => {
      const manager = await Harness.member('manager');
      const employee = await Harness.user();
      await Harness.team({ manager_id: manager.row.id, members: [employee.id] });
      const id = await Harness.clock({
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(6),
        user_id: employee.id,
      });
      const result = await Harness.call<BulkBody>('PATCH', '/v1/clocks', {
        body: { data: { clocked_out_at: hoursAgo(5), note: 'Corrected' }, ids: [id, MISSING_ID] },
        token: manager.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.updated).toEqual([id]);
      expect(result.body.data.failed).toEqual([{ code: 'clock.not.found', id: MISSING_ID }]);
      const check = await Harness.call<ClockBody>('GET', `/v1/clocks/${id}`, {
        token: manager.access_token,
      });
      expect(check.body.data.clock.note).toBe('Corrected');
      expect(check.body.data.clock.updated_at).not.toBeNull();
    });

    test('forbids employees and rejects an empty update', async () => {
      const employee = await Harness.member('employee');
      const manager = await Harness.member('manager');
      const id = await Harness.clock({
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(9),
        user_id: employee.row.id,
      });
      const denied = await Harness.call<ErrorBody>('PATCH', '/v1/clocks', {
        body: { data: { note: 'x' }, ids: [id] },
        token: employee.access_token,
      });
      expect(denied.status).toBe(403);
      const empty = await Harness.call<ErrorBody>('PATCH', '/v1/clocks', {
        body: { data: {}, ids: [id] },
        token: manager.access_token,
      });
      expect(empty.status).toBe(400);
    });

    test('deletes clocks for an admin and forbids employees', async () => {
      const admin = await Harness.member('admin');
      const employee = await Harness.member('employee');
      const id = await Harness.clock({
        clocked_in_at: hoursAgo(10),
        clocked_out_at: hoursAgo(9),
        user_id: employee.row.id,
      });
      const denied = await Harness.call<ErrorBody>('DELETE', '/v1/clocks', {
        body: { ids: [id] },
        token: employee.access_token,
      });
      expect(denied.status).toBe(403);
      const result = await Harness.call<BulkBody>('DELETE', '/v1/clocks', {
        body: { ids: [id, MISSING_ID] },
        token: admin.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.deleted).toEqual([id]);
      expect(result.body.data.failed).toEqual([{ code: 'clock.not.found', id: MISSING_ID }]);
      expect(await db.select().from(clocks).where(eq(clocks.id, id))).toEqual([]);
    });
  });
});
