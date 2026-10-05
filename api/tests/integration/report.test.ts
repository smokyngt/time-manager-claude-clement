import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { Harness, MISSING_ID } from './setup.js';

import type { ErrorBody, Reply } from './setup.js';
import type { TeamReport, UserReport } from '@/types/entities/index.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MONDAY = Date.UTC(2026, 0, 12);
const range = { from: MONDAY, granularity: 'day', to: MONDAY + 5 * DAY } as const;

const shift = async (userId: string, day: number, start: number, end: number): Promise<void> => {
  await Harness.clock({
    clocked_in_at: MONDAY + day * DAY + start * HOUR,
    clocked_out_at: MONDAY + day * DAY + end * HOUR,
    user_id: userId,
  });
};

describe('reports', () => {
  beforeAll(async () => {
    await Harness.start();
  });

  beforeEach(async () => {
    await Harness.reset();
  });

  afterAll(async () => {
    await Harness.stop();
  });

  describe('user', () => {
    test('aggregates worked time per day for the employee themselves', async () => {
      const employee = await Harness.member('employee');
      await shift(employee.row.id, 0, 8, 16);
      await shift(employee.row.id, 1, 8, 12);
      const result = await Harness.call<Reply<{ report: UserReport }>>('POST', '/v1/reports/user', {
        body: { ...range, user_id: employee.row.id },
        token: employee.access_token,
      });
      expect(result.status).toBe(200);
      expect(result.body.event.code).toBe('report.user.generated');
      const { report } = result.body.data;
      expect(report).toMatchObject({
        from: range.from,
        granularity: 'day',
        object: 'user_report',
        to: range.to,
        user_id: employee.row.id,
      });
      expect(report.kpis.worked_ms).toBe(12 * HOUR);
      expect(report.kpis.days_worked).toBe(2);
      expect(report.series.reduce((sum, point) => sum + point.worked_ms, 0)).toBe(12 * HOUR);
      expect(report.series[0]?.worked_ms).toBe(8 * HOUR);
    });

    test('lets admins and the manager of the employee read it, hides it from others', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const stranger = await Harness.member('manager');
      const peer = await Harness.member('employee');
      const employee = await Harness.user();
      await Harness.team({ manager_id: manager.row.id, members: [employee.id] });
      await shift(employee.id, 0, 8, 16);
      for (const caller of [admin, manager]) {
        const allowed = await Harness.call<Reply<{ report: UserReport }>>(
          'POST',
          '/v1/reports/user',
          { body: { ...range, user_id: employee.id }, token: caller.access_token },
        );
        expect(allowed.status).toBe(200);
        expect(allowed.body.data.report.kpis.worked_ms).toBe(8 * HOUR);
      }
      for (const caller of [stranger, peer]) {
        const hidden = await Harness.call<ErrorBody>('POST', '/v1/reports/user', {
          body: { ...range, user_id: employee.id },
          token: caller.access_token,
        });
        expect(hidden.status).toBe(404);
        expect(hidden.body.code).toBe('report.user.not.found');
      }
    });

    test('validates the range and requires authentication', async () => {
      const employee = await Harness.member('employee');
      const anonymous = await Harness.call<ErrorBody>('POST', '/v1/reports/user', {
        body: { ...range, user_id: employee.row.id },
      });
      expect(anonymous.status).toBe(401);
      const missing = await Harness.call<ErrorBody>('POST', '/v1/reports/user', {
        body: { user_id: employee.row.id },
        token: employee.access_token,
      });
      expect(missing.status).toBe(400);
      expect(missing.body.code).toBe('validation.error');
      const granularity = await Harness.call<ErrorBody>('POST', '/v1/reports/user', {
        body: { ...range, granularity: 'year', user_id: employee.row.id },
        token: employee.access_token,
      });
      expect(granularity.status).toBe(400);
      const reversed = await Harness.call<ErrorBody>('POST', '/v1/reports/user', {
        body: { ...range, from: range.to, to: range.from, user_id: employee.row.id },
        token: employee.access_token,
      });
      expect(reversed.status).toBe(400);
      expect(reversed.body.code).toBe('report.invalid');
      const tooLong = await Harness.call<ErrorBody>('POST', '/v1/reports/user', {
        body: { ...range, to: range.from + 400 * DAY, user_id: employee.row.id },
        token: employee.access_token,
      });
      expect(tooLong.status).toBe(400);
    });
  });

  describe('team', () => {
    test('reports the members of a team to its manager and to an admin', async () => {
      const admin = await Harness.member('admin');
      const manager = await Harness.member('manager');
      const first = await Harness.user({ first_name: 'Ada' });
      const second = await Harness.user({ first_name: 'Bob' });
      const teamId = await Harness.team({
        manager_id: manager.row.id,
        members: [first.id, second.id],
      });
      await shift(first.id, 0, 8, 16);
      await shift(second.id, 0, 8, 12);
      for (const caller of [manager, admin]) {
        const result = await Harness.call<Reply<{ report: TeamReport }>>(
          'POST',
          '/v1/reports/team',
          { body: { ...range, team_id: teamId }, token: caller.access_token },
        );
        expect(result.status).toBe(200);
        expect(result.body.event.code).toBe('report.team.generated');
        const { report } = result.body.data;
        expect(report.object).toBe('team_report');
        expect(report.team_id).toBe(teamId);
        expect(report.kpis.worked_ms).toBe(12 * HOUR);
        expect(report.kpis.member_count).toBe(2);
        expect(report.members.map((member) => member.first_name).sort()).toEqual(['Ada', 'Bob']);
      }
    });

    test('forbids employees, hides the team from other managers and answers 404 on unknown ids', async () => {
      const manager = await Harness.member('manager');
      const stranger = await Harness.member('manager');
      const employee = await Harness.member('employee');
      const teamId = await Harness.team({ manager_id: manager.row.id, members: [employee.row.id] });
      const asEmployee = await Harness.call<ErrorBody>('POST', '/v1/reports/team', {
        body: { ...range, team_id: teamId },
        token: employee.access_token,
      });
      expect(asEmployee.status).toBe(403);
      expect(asEmployee.body.code).toBe('unauthorized');
      const asStranger = await Harness.call<ErrorBody>('POST', '/v1/reports/team', {
        body: { ...range, team_id: teamId },
        token: stranger.access_token,
      });
      expect(asStranger.status).toBe(404);
      expect(asStranger.body.code).toBe('report.team.not.found');
      const unknown = await Harness.call<ErrorBody>('POST', '/v1/reports/team', {
        body: { ...range, team_id: MISSING_ID },
        token: manager.access_token,
      });
      expect(unknown.status).toBe(404);
    });
  });
});
