import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers, teams } from '@/db/schema/index.js';

import { Harness, MISSING_ID } from './setup.js';

import type { ErrorBody, Reply } from './setup.js';
import type { Team } from '@/types/entities/index.js';

type BulkBody = {
  data: {
    deleted?: string[];
    failed: { code: string; id: string }[];
    success: boolean;
    updated?: string[];
  };
};

type ListBody = { data: { items: Team[]; more: boolean; next: null | string; total: number } };

type TeamBody = { data: { team: Team } };

describe('teams', () => {
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
    test('lets an admin create a team for a manager and seals the text at rest', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.user({ role: 'manager' });
      const result = await Harness.call<Reply<{ team: Team }>>('POST', '/v1/teams/new', {
        body: { description: 'Handles support', manager_id: manager.id, name: 'Support' },
        token: admin.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.event.code).toBe('team.created');
      expect(result.body.event.correlation_id).toBe(result.headers['x-request-id'] as string);
      expect(result.body.data.team).toMatchObject({
        archived_at: null,
        description: 'Handles support',
        manager_id: manager.id,
        member_count: 0,
        name: 'Support',
        object: 'team',
        weekly_hours_target: 35,
        work_end: '17:00',
        work_start: '09:00',
      });
      const [stored] = await db.select().from(teams).where(eq(teams.id, result.body.data.team.id));
      expect(stored?.name).toStartWith('v1.');
      expect(stored?.description).toStartWith('v1.');
    });

    test('forces a manager to be the manager of the team they create', async () => {
      const manager = await Harness.member('manager');
      const other = await Harness.user({ role: 'manager' });
      const result = await Harness.call<TeamBody>('POST', '/v1/teams/new', {
        body: { manager_id: other.id, name: 'Mine' },
        token: manager.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.team.manager_id).toBe(manager.row.id);
    });

    test('forbids an employee and requires authentication', async () => {
      const employee = await Harness.member('employee');
      const forbidden = await Harness.call<ErrorBody>('POST', '/v1/teams/new', {
        body: { name: 'Nope' },
        token: employee.access_token,
      });
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.code).toBe('unauthorized');
      const anonymous = await Harness.call<ErrorBody>('POST', '/v1/teams/new', {
        body: { name: 'Nope' },
      });
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.code).toBe('token.authentication.failed');
    });

    test('rejects invalid input with the validation envelope', async () => {
      const admin = await Harness.member('admin');
      const missing = await Harness.call<ErrorBody>('POST', '/v1/teams/new', {
        body: {},
        token: admin.access_token,
      });
      expect(missing.status).toBe(400);
      expect(missing.body).toMatchObject({ code: 'validation.error', instance: '/v1/teams/new' });
      expect(missing.body.errors?.[0]).toMatchObject({ code: 'required', path: 'body.name' });
      const badTime = await Harness.call<ErrorBody>('POST', '/v1/teams/new', {
        body: { name: 'Late', work_start: '9am' },
        token: admin.access_token,
      });
      expect(badTime.status).toBe(400);
      expect(badTime.body.errors?.[0]).toMatchObject({ path: 'body.work_start' });
    });
  });

  describe('list and retrieve', () => {
    test('shows every team to an admin, managed teams to a manager, own teams to an employee', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const employee = await Harness.member('employee');
      const otherManager = await Harness.user({ role: 'manager' });
      const mine = await Harness.team({ manager_id: manager.row.id, members: [employee.row.id] });
      await Harness.team({ manager_id: otherManager.id });
      const asAdmin = await Harness.call<ListBody>('POST', '/v1/teams/list', {
        body: {},
        token: admin.access_token,
      });
      expect(asAdmin.body.data.total).toBe(2);
      const asManager = await Harness.call<ListBody>('POST', '/v1/teams/list', {
        body: {},
        token: manager.access_token,
      });
      expect(asManager.body.data.items.map((item) => item.id)).toEqual([mine]);
      const asEmployee = await Harness.call<ListBody>('POST', '/v1/teams/list', {
        body: {},
        token: employee.access_token,
      });
      expect(asEmployee.body.data.items.map((item) => item.id)).toEqual([mine]);
      expect(asEmployee.body.data.items[0]?.member_count).toBe(1);
    });

    test('paginates with a cursor and filters archived teams', async () => {
      const admin = await Harness.member('admin');
      for (let index = 0; index < 5; index += 1) {
        await Harness.team({ manager_id: admin.row.id });
      }
      await Harness.team({ archived_at: Date.now(), manager_id: admin.row.id });
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await Harness.call<ListBody>('POST', '/v1/teams/list', {
          body: { archived: false, cursor, limit: 2 },
          token: admin.access_token,
        });
        seen.push(...page.body.data.items.map((item) => item.id));
        cursor = page.body.data.next ?? undefined;
        pages += 1;
      } while (cursor !== undefined && pages < 10);
      expect(pages).toBe(3);
      expect(new Set(seen).size).toBe(5);
      const archived = await Harness.call<ListBody>('POST', '/v1/teams/list', {
        body: { archived: true },
        token: admin.access_token,
      });
      expect(archived.body.data.total).toBe(1);
    });

    test('retrieves a team for its members and hides it from outsiders', async () => {
      const manager = await Harness.member('manager');
      const employee = await Harness.member('employee');
      const outsider = await Harness.member('employee');
      const id = await Harness.team({
        description: 'Secret plans',
        manager_id: manager.row.id,
        members: [employee.row.id],
        name: 'Alpha',
      });
      const asMember = await Harness.call<TeamBody>('GET', `/v1/teams/${id}`, {
        token: employee.access_token,
      });
      expect(asMember.status).toBe(200);
      expect(asMember.body.data.team).toMatchObject({ description: 'Secret plans', name: 'Alpha' });
      const hidden = await Harness.call<ErrorBody>('GET', `/v1/teams/${id}`, {
        token: outsider.access_token,
      });
      expect(hidden.status).toBe(404);
      expect(hidden.body.code).toBe('team.not.found');
      const unknown = await Harness.call<ErrorBody>('GET', `/v1/teams/${MISSING_ID}`, {
        token: manager.access_token,
      });
      expect(unknown.status).toBe(404);
      const bad = await Harness.call<ErrorBody>('GET', '/v1/teams/not-a-uuid', {
        token: manager.access_token,
      });
      expect(bad.status).toBe(400);
    });
  });

  describe('update', () => {
    test('lets the manager rename the team and reports unknown ids as failed', async () => {
      const manager = await Harness.member('manager');
      const id = await Harness.team({ manager_id: manager.row.id, name: 'Before' });
      const result = await Harness.call<BulkBody>('PATCH', '/v1/teams', {
        body: { data: { name: 'After', weekly_hours_target: 30 }, ids: [id, id, MISSING_ID] },
        token: manager.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.updated).toEqual([id]);
      expect(result.body.data.failed).toEqual([{ code: 'team.not.found', id: MISSING_ID }]);
      expect(result.body.data.success).toBe(false);
      const check = await Harness.call<TeamBody>('GET', `/v1/teams/${id}`, {
        token: manager.access_token,
      });
      expect(check.body.data.team).toMatchObject({ name: 'After', weekly_hours_target: 30 });
      expect(check.body.data.team.updated_at).not.toBeNull();
    });

    test('keeps the manager assignment for admins only', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const next = await Harness.user({ role: 'manager' });
      const id = await Harness.team({ manager_id: manager.row.id });
      const denied = await Harness.call<ErrorBody>('PATCH', '/v1/teams', {
        body: { data: { manager_id: next.id }, ids: [id] },
        token: manager.access_token,
      });
      expect(denied.status).toBe(403);
      const allowed = await Harness.call<BulkBody>('PATCH', '/v1/teams', {
        body: { data: { manager_id: next.id }, ids: [id] },
        token: admin.access_token,
      });
      expect(allowed.body.data.success).toBe(true);
    });

    test('forbids employees and managers of other teams and rejects empty input', async () => {
      const manager = await Harness.member('manager');
      const stranger = await Harness.member('manager');
      const employee = await Harness.member('employee');
      const id = await Harness.team({ manager_id: manager.row.id, members: [employee.row.id] });
      const asEmployee = await Harness.call<ErrorBody>('PATCH', '/v1/teams', {
        body: { data: { name: 'X' }, ids: [id] },
        token: employee.access_token,
      });
      expect(asEmployee.status).toBe(403);
      const asStranger = await Harness.call<BulkBody>('PATCH', '/v1/teams', {
        body: { data: { name: 'X' }, ids: [id] },
        token: stranger.access_token,
      });
      expect(asStranger.body.data.updated).toEqual([]);
      expect(asStranger.body.data.failed).toEqual([{ code: 'team.not.found', id }]);
      const empty = await Harness.call<ErrorBody>('PATCH', '/v1/teams', {
        body: { data: {}, ids: [id] },
        token: manager.access_token,
      });
      expect(empty.status).toBe(400);
    });
  });

  describe('archive, restore and delete', () => {
    test('archives then restores a team', async () => {
      const manager = await Harness.member('manager');
      const id = await Harness.team({ manager_id: manager.row.id });
      const archived = await Harness.call<Reply<{ team: Team }>>('POST', `/v1/teams/${id}/archive`, {
        token: manager.access_token,
      });
      expect(archived.status).toBe(200);
      expect(archived.body.event.code).toBe('team.archived');
      expect(archived.body.data.team.archived_at).not.toBeNull();
      const restored = await Harness.call<TeamBody>('POST', `/v1/teams/${id}/restore`, {
        token: manager.access_token,
      });
      expect(restored.body.data.team.archived_at).toBeNull();
    });

    test('forbids employees and answers 404 on unknown teams', async () => {
      const manager = await Harness.member('manager');
      const employee = await Harness.member('employee');
      const id = await Harness.team({ manager_id: manager.row.id, members: [employee.row.id] });
      const forbidden = await Harness.call<ErrorBody>('POST', `/v1/teams/${id}/archive`, {
        token: employee.access_token,
      });
      expect(forbidden.status).toBe(403);
      const unknown = await Harness.call<ErrorBody>('POST', `/v1/teams/${MISSING_ID}/restore`, {
        token: manager.access_token,
      });
      expect(unknown.status).toBe(404);
      expect(unknown.body.code).toBe('team.not.found');
    });

    test('lets an admin delete a team with its memberships, but not a manager', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const employee = await Harness.user();
      const id = await Harness.team({ manager_id: manager.row.id, members: [employee.id] });
      const denied = await Harness.call<ErrorBody>('DELETE', '/v1/teams', {
        body: { ids: [id] },
        token: manager.access_token,
      });
      expect(denied.status).toBe(403);
      const result = await Harness.call<BulkBody>('DELETE', '/v1/teams', {
        body: { ids: [id, MISSING_ID] },
        token: admin.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.deleted).toEqual([id]);
      expect(result.body.data.failed).toEqual([{ code: 'team.not.found', id: MISSING_ID }]);
      const remaining = await db.select().from(teamMembers).where(eq(teamMembers.team_id, id));
      expect(remaining).toEqual([]);
    });
  });
});
