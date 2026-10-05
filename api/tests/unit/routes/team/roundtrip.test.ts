import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test';

import { Roles } from '@/config/auth/roles.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { Identity } from '@/middlewares/auth/identity.js';

import { FakeDb } from '../../../support/db.js';
import { Prehandler } from '../../../support/prehandler.js';
import { actorOf, ADMIN_ID, MANAGER_ID, rowOf, TEAM_ID } from '../../services/team/support.js';

import type { TeamResponse } from '@/controllers/team/index.js';
import type { Role } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyInstance } from 'fastify';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

const { teams } = await import('@/routes/team/index.js');

let app: FastifyInstance;
let authorization = '';
let role: Role = 'admin';

beforeAll(async () => {
  spyOn(Roles, 'scopes').mockImplementation(() => ['teams:manage', 'teams:read']);
  spyOn(Identity, 'load').mockImplementation(() => Promise.resolve(actorOf(role)));
  app = await Prehandler.app(teams, '/v1/teams');
  const { token } = await Tokens.access({ id: ADMIN_ID, role: 'admin' });
  authorization = `Bearer ${token}`;
});

afterEach(() => {
  role = 'admin';
  fakeDb.reset();
});

afterAll(async () => {
  await app.close();
  mock.restore();
  void mock.module('@/db/client.js', () => realDb);
});

describe('routes.team round trip', () => {
  it('creates a team and lists it with the response envelope and decrypted text', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'manager' }], [rowOf()], []);
    const created = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { manager_id: MANAGER_ID, name: 'Customer support' },
      url: '/v1/teams/new',
    });
    expect(created.statusCode).toBe(200);
    const body = created.json<ReplyEnvelope<TeamResponse>>();
    expect(body.data.team).toMatchObject({
      manager_id: MANAGER_ID,
      member_count: 0,
      name: 'Customer support',
      object: 'team',
      weekly_hours_target: 35,
      work_end: '17:00',
      work_start: '09:00',
    });
    expect(body.event).toMatchObject({
      code: 'team.created',
      payload: { actor: ADMIN_ID, team_id: TEAM_ID },
    });
    expect(body.event.correlation_id).toBeString();
    expect(JSON.stringify(body)).not.toContain('v1.');

    fakeDb.enqueue([rowOf()], [{ total: 1 }], [{ id: TEAM_ID, total: 4 }]);
    const listed = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { limit: 10 },
      url: '/v1/teams/list',
    });
    expect(listed.statusCode).toBe(200);
    const page = listed.json<ReplyEnvelope<{ items: { member_count: number }[]; total: number }>>();
    expect(page.data).toMatchObject({ more: false, next: null, total: 1 });
    expect(page.data.items[0]?.member_count).toBe(4);
    expect(page.event.code).toBe('team.listed');
  });

  it('rejects an invalid body with validation.error', async () => {
    const response = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { name: '' },
      url: '/v1/teams/new',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('validation.error');
  });

  it('answers 400 team.manager.invalid for an employee manager', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'employee' }]);
    const response = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { manager_id: MANAGER_ID, name: 'Customer support' },
      url: '/v1/teams/new',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('team.manager.invalid');
  });

  it('answers 400 team.schedule.invalid when the day ends before it starts', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'manager' }]);
    const response = await app.inject({
      headers: { authorization },
      method: 'POST',
      payload: { manager_id: MANAGER_ID, name: 'Customer support', work_end: '08:00' },
      url: '/v1/teams/new',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('team.schedule.invalid');
  });

  it('answers 404 team.not.found for an unknown team', async () => {
    fakeDb.enqueue([]);
    const response = await app.inject({
      headers: { authorization },
      method: 'GET',
      url: '/v1/teams/00000000-0000-4000-8000-0000000000ff',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('team.not.found');
  });

  it('answers 404 for a team outside the visibility of an employee', async () => {
    role = 'employee';
    fakeDb.enqueue([rowOf()], [{ total: 1 }], []);
    const response = await app.inject({
      headers: { authorization },
      method: 'GET',
      url: `/v1/teams/${TEAM_ID}`,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('team.not.found');
  });

  it('answers 403 unauthorized when a visible team cannot be archived', async () => {
    role = 'employee';
    fakeDb.enqueue([rowOf()], [{ total: 1 }], [{ user_id: 'member' }]);
    const response = await app.inject({
      headers: { authorization },
      method: 'POST',
      url: `/v1/teams/${TEAM_ID}/archive`,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('unauthorized');
  });
});
