import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers } from '@/db/schema/index.js';

import { Harness, MISSING_ID } from './setup.js';

import type { ErrorBody, Reply } from './setup.js';
import type { User } from '@/types/entities/index.js';

type AddData = { added: string[]; failed: { code: string; id: string }[]; success: boolean };

type ListData = { items: User[]; more: boolean; next: null | string; total: number };

type RemoveData = { failed: { code: string; id: string }[]; removed: string[]; success: boolean };

describe('team members', () => {
  beforeAll(async () => {
    await Harness.start();
  });

  beforeEach(async () => {
    await Harness.reset();
  });

  afterAll(async () => {
    await Harness.stop();
  });

  describe('add', () => {
    test('lets the manager add employees, dedupes ids and reports failures', async () => {
      const manager = await Harness.member('manager');
      const teamId = await Harness.team({ manager_id: manager.row.id });
      const first = await Harness.user();
      const second = await Harness.user();
      const archived = await Harness.user({ archived_at: Date.now() });
      const result = await Harness.call<Reply<AddData>>('POST', `/v1/teams/${teamId}/members/add`, {
        body: { user_ids: [first.id, first.id, second.id, archived.id, MISSING_ID] },
        token: manager.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.event.code).toBe('team.members.added');
      expect([...result.body.data.added].sort()).toEqual([first.id, second.id].sort());
      expect(result.body.data.success).toBe(false);
      expect(result.body.data.failed).toContainEqual({
        code: 'team.member.user.archived',
        id: archived.id,
      });
      expect(result.body.data.failed).toContainEqual({
        code: 'team.member.user.not.found',
        id: MISSING_ID,
      });
      const stored = await db.select().from(teamMembers).where(eq(teamMembers.team_id, teamId));
      expect(stored).toHaveLength(2);
    });

    test('is idempotent for users that are already members', async () => {
      const manager = await Harness.member('manager');
      const member = await Harness.user();
      const teamId = await Harness.team({ manager_id: manager.row.id, members: [member.id] });
      const result = await Harness.call<Reply<AddData>>('POST', `/v1/teams/${teamId}/members/add`, {
        body: { user_ids: [member.id] },
        token: manager.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.data.added).toEqual([]);
    });

    test('only lets an admin add managers and admins', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const peer = await Harness.user({ role: 'manager' });
      const teamId = await Harness.team({ manager_id: manager.row.id });
      const denied = await Harness.call<ErrorBody>('POST', `/v1/teams/${teamId}/members/add`, {
        body: { user_ids: [peer.id] },
        token: manager.access_token,
      });
      expect(denied.status).toBe(403);
      const allowed = await Harness.call<Reply<AddData>>(
        'POST',
        `/v1/teams/${teamId}/members/add`,
        { body: { user_ids: [peer.id] }, token: admin.access_token },
      );
      expect(allowed.body.data.added).toEqual([peer.id]);
    });

    test('rejects archived teams with a 409', async () => {
      const manager = await Harness.member('manager');
      const employee = await Harness.user();
      const teamId = await Harness.team({ archived_at: Date.now(), manager_id: manager.row.id });
      const result = await Harness.call<ErrorBody>('POST', `/v1/teams/${teamId}/members/add`, {
        body: { user_ids: [employee.id] },
        token: manager.access_token,
      });
      expect(result.status).toBe(409);
      expect(result.body.code).toBe('team.member.team.archived');
    });

    test('forbids employees and other managers, and answers 404 on unknown teams', async () => {
      const manager = await Harness.member('manager');
      const stranger = await Harness.member('manager');
      const employee = await Harness.member('employee');
      const target = await Harness.user();
      const teamId = await Harness.team({ manager_id: manager.row.id });
      for (const caller of [employee, stranger]) {
        const result = await Harness.call<ErrorBody>('POST', `/v1/teams/${teamId}/members/add`, {
          body: { user_ids: [target.id] },
          token: caller.access_token,
        });
        expect(result.status).toBe(403);
        expect(result.body.code).toBe('unauthorized');
      }
      const unknown = await Harness.call<ErrorBody>('POST', `/v1/teams/${MISSING_ID}/members/add`, {
        body: { user_ids: [target.id] },
        token: manager.access_token,
      });
      expect(unknown.status).toBe(404);
    });

    test('validates the body and requires authentication', async () => {
      const manager = await Harness.member('manager');
      const teamId = await Harness.team({ manager_id: manager.row.id });
      const empty = await Harness.call<ErrorBody>('POST', `/v1/teams/${teamId}/members/add`, {
        body: { user_ids: [] },
        token: manager.access_token,
      });
      expect(empty.status).toBe(400);
      expect(empty.body.code).toBe('validation.error');
      const badId = await Harness.call<ErrorBody>('POST', `/v1/teams/${teamId}/members/add`, {
        body: { user_ids: ['not-a-uuid'] },
        token: manager.access_token,
      });
      expect(badId.status).toBe(400);
      const anonymous = await Harness.call<ErrorBody>('POST', `/v1/teams/${teamId}/members/add`, {
        body: { user_ids: [MISSING_ID] },
      });
      expect(anonymous.status).toBe(401);
    });
  });

  describe('list', () => {
    test('lists the members to the manager, a member and an admin', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const employee = await Harness.member('employee', { first_name: 'Maya' });
      const other = await Harness.user();
      const teamId = await Harness.team({
        manager_id: manager.row.id,
        members: [employee.row.id, other.id],
      });
      for (const caller of [admin, manager, employee]) {
        const result = await Harness.call<Reply<ListData>>(
          'POST',
          `/v1/teams/${teamId}/members/list`,
          { body: { limit: 10 }, token: caller.access_token },
        );
        expect(result.status).toBe(200);
        expect(result.body.event.code).toBe('team.members.listed');
        expect(result.body.data.total).toBe(2);
        expect(result.body.data.items.map((item) => item.first_name)).toContain('Maya');
        expect(result.body.data.items[0]).not.toHaveProperty('password_hash');
      }
    });

    test('paginates and forbids non members', async () => {
      const manager = await Harness.member('manager');
      const outsider = await Harness.member('employee');
      const members = [await Harness.user(), await Harness.user(), await Harness.user()];
      const teamId = await Harness.team({
        manager_id: manager.row.id,
        members: members.map((member) => member.id),
      });
      const page = await Harness.call<Reply<ListData>>('POST', `/v1/teams/${teamId}/members/list`, {
        body: { limit: 2 },
        token: manager.access_token,
      });
      expect(page.body.data.items).toHaveLength(2);
      expect(page.body.data.more).toBe(true);
      expect(page.body.data.next).not.toBeNull();
      const forbidden = await Harness.call<ErrorBody>('POST', `/v1/teams/${teamId}/members/list`, {
        body: {},
        token: outsider.access_token,
      });
      expect(forbidden.status).toBe(403);
    });
  });

  describe('remove', () => {
    test('removes members and reports the ones that were not members', async () => {
      const manager = await Harness.member('manager');
      const member = await Harness.user();
      const keep = await Harness.user();
      const teamId = await Harness.team({
        manager_id: manager.row.id,
        members: [member.id, keep.id],
      });
      const result = await Harness.call<Reply<RemoveData>>(
        'POST',
        `/v1/teams/${teamId}/members/remove`,
        { body: { user_ids: [member.id, MISSING_ID] }, token: manager.access_token },
      );
      expect(result.status).toBe(200);
      expect(result.body.event.code).toBe('team.members.removed');
      expect(result.body.data.removed).toEqual([member.id]);
      expect(result.body.data.failed).toHaveLength(1);
      expect(result.body.data.success).toBe(false);
      const left = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, keep.id)));
      expect(left).toHaveLength(1);
    });

    test('forbids employees and managers of other teams', async () => {
      const manager = await Harness.member('manager');
      const stranger = await Harness.member('manager');
      const employee = await Harness.member('employee');
      const teamId = await Harness.team({ manager_id: manager.row.id, members: [employee.row.id] });
      for (const caller of [employee, stranger]) {
        const result = await Harness.call<ErrorBody>(
          'POST',
          `/v1/teams/${teamId}/members/remove`,
          { body: { user_ids: [employee.row.id] }, token: caller.access_token },
        );
        expect(result.status).toBe(403);
      }
      const stored = await db.select().from(teamMembers).where(eq(teamMembers.team_id, teamId));
      expect(stored).toHaveLength(1);
    });
  });
});
