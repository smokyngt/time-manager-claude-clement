import { describe, expect, test } from 'bun:test';

import { TimeManagerClient } from '../client.js';
import { envelope, fakeFetch } from './support.js';

import type { Call } from './support.js';

function setup(data: unknown = {}): { calls: Call[]; client: TimeManagerClient } {
  const { calls, fetch } = fakeFetch(() => envelope(data));
  const client = new TimeManagerClient({ baseUrl: 'http://api', fetch, getToken: () => 'tok' });

  return { calls, client };
}

const bulk = { failed: [], success: true, updated: ['1'] };

describe('resources', () => {
  test('auth', async () => {
    const { calls, client } = setup({
      access_token: 'a',
      expires_in: 1,
      scopes: ['auth:self'],
      token_type: 'Bearer',
      user: {},
    });
    const session = await client.auth.login({ email: 'a@b.c', password: 'p' });
    expect(session.accessToken).toBe('a');
    expect(session.scopes).toEqual(['auth:self']);
    await client.auth.me();
    await client.auth.logout();
    await client.auth.refresh();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST http://api/v1/auth/login',
      'GET http://api/v1/auth/me',
      'POST http://api/v1/auth/logout',
      'POST http://api/v1/auth/refresh',
    ]);
    expect(calls[0]?.body).toEqual({ email: 'a@b.c', password: 'p' });
    expect(client.auth.microsoftUrl()).toBe('http://api/v1/auth/microsoft');
  });

  test('users', async () => {
    const { calls, client } = setup({ user: { id: '1' }, ...bulk });
    const created = await client.users.create({ email: 'e', firstName: 'f', lastName: 'l' });
    expect(created.user.id).toBe('1');
    await client.users.list({ cursor: 'c', teamId: 't' });
    await client.users.retrieve('1');
    await client.users.update(['1'], { phoneNumber: null });
    await client.users.archive('1');
    await client.users.restore('1');
    await client.users.delete(['1']);
    expect(calls.map((c) => `${c.method} ${c.url.replace('http://api', '')}`)).toEqual([
      'POST /v1/users/new',
      'POST /v1/users/list',
      'GET /v1/users/1',
      'PATCH /v1/users',
      'POST /v1/users/1/archive',
      'POST /v1/users/1/restore',
      'DELETE /v1/users',
    ]);
    expect(calls[0]?.body).toEqual({ email: 'e', first_name: 'f', last_name: 'l' });
    expect(calls[1]?.body).toEqual({ cursor: 'c', team_id: 't' });
    expect(calls[3]?.body).toEqual({ data: { phone_number: null }, ids: ['1'] });
    expect(calls[6]?.body).toEqual({ ids: ['1'] });
  });

  test('teams', async () => {
    const { calls, client } = setup({ team: { id: 't' }, ...bulk });
    await client.teams.create({ name: 'n', weeklyHoursTarget: 30, workStart: '08:00' });
    await client.teams.list({ managerId: 'm', memberId: 'u' });
    await client.teams.retrieve('t');
    await client.teams.update(['t'], { workEnd: '18:00' });
    await client.teams.archive('t');
    await client.teams.restore('t');
    await client.teams.delete(['t']);
    expect(calls.map((c) => `${c.method} ${c.url.replace('http://api', '')}`)).toEqual([
      'POST /v1/teams/new',
      'POST /v1/teams/list',
      'GET /v1/teams/t',
      'PATCH /v1/teams',
      'POST /v1/teams/t/archive',
      'POST /v1/teams/t/restore',
      'DELETE /v1/teams',
    ]);
    expect(calls[0]?.body).toEqual({ name: 'n', weekly_hours_target: 30, work_start: '08:00' });
    expect(calls[1]?.body).toEqual({ manager_id: 'm', member_id: 'u' });
    expect(calls[3]?.body).toEqual({ data: { work_end: '18:00' }, ids: ['t'] });
  });

  test('team members', async () => {
    const { calls, client } = setup({ added: [], failed: [], items: [], success: true });
    await client.teamMembers.add('t', ['u1', 'u2']);
    await client.teamMembers.remove('t', ['u1']);
    await client.teamMembers.list('t', { limit: 5, skip: 2 });
    expect(calls.map((c) => `${c.method} ${c.url.replace('http://api', '')}`)).toEqual([
      'POST /v1/teams/t/members/add',
      'POST /v1/teams/t/members/remove',
      'POST /v1/teams/t/members/list',
    ]);
    expect(calls[0]?.body).toEqual({ user_ids: ['u1', 'u2'] });
    expect(calls[1]?.body).toEqual({ user_ids: ['u1'] });
    expect(calls[2]?.body).toEqual({ limit: 5, skip: 2 });
  });

  test('clocks', async () => {
    const { calls, client } = setup({ clock: { id: 'c' }, ...bulk });
    await client.clocks.in({ note: 'hi' });
    await client.clocks.out({});
    expect((await client.clocks.current()).clock?.id).toBe('c');
    await client.clocks.create({ clockedInAt: 1, clockedOutAt: 2, userId: 'u' });
    await client.clocks.list({ open: true, userIds: ['u'] });
    await client.clocks.retrieve('c');
    await client.clocks.update(['c'], { note: 'n' });
    await client.clocks.delete(['c']);
    expect(calls.map((c) => `${c.method} ${c.url.replace('http://api', '')}`)).toEqual([
      'POST /v1/clocks/in',
      'POST /v1/clocks/out',
      'GET /v1/clocks/current',
      'POST /v1/clocks/new',
      'POST /v1/clocks/list',
      'GET /v1/clocks/c',
      'PATCH /v1/clocks',
      'DELETE /v1/clocks',
    ]);
    expect(calls[0]?.body).toEqual({ note: 'hi' });
    expect(calls[3]?.body).toEqual({ clocked_in_at: 1, clocked_out_at: 2, user_id: 'u' });
    expect(calls[4]?.body).toEqual({ open: true, user_ids: ['u'] });
  });

  test('reports', async () => {
    const { calls, client } = setup({ report: { object: 'user_report' } });
    await client.reports.user({ from: 1, granularity: 'week', to: 2, userId: 'u' });
    await client.reports.team({ from: 1, granularity: 'day', teamId: 't', to: 2 });
    expect(calls.map((c) => `${c.method} ${c.url.replace('http://api', '')}`)).toEqual([
      'POST /v1/reports/user',
      'POST /v1/reports/team',
    ]);
    expect(calls[0]?.body).toEqual({ from: 1, granularity: 'week', to: 2, user_id: 'u' });
    expect(calls[1]?.body).toEqual({ from: 1, granularity: 'day', team_id: 't', to: 2 });
  });
});
