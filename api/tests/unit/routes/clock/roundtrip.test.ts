import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test';

import { Roles } from '@/config/auth/roles.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { Identity } from '@/middlewares/auth/identity.js';

import { FakeDb } from '../../../support/db.js';
import { Prehandler } from '../../../support/prehandler.js';
import { actorOf, EMPLOYEE_ID, OTHER_ID, rowOf, sealed } from '../../services/clock/support.js';

import type { ClockResponse, CurrentResponse } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyInstance } from 'fastify';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

const { clocks } = await import('@/routes/clock/index.js');

let app: FastifyInstance;
let authorization = '';

const started = Date.now() - 3_600_000;
const openRow = rowOf({
  clocked_in_at: started,
  clocked_out_at: null,
  note: sealed('Morning'),
  user_id: EMPLOYEE_ID,
});

beforeAll(async () => {
  spyOn(Roles, 'scopes').mockImplementation(() => ['clocks:read', 'clocks:write']);
  spyOn(Identity, 'load').mockImplementation(() => Promise.resolve(actorOf('employee')));
  app = await Prehandler.app(clocks, '/v1/clocks');
  const { token } = await Tokens.access({ id: EMPLOYEE_ID, role: 'employee' });
  authorization = `Bearer ${token}`;
});

afterEach(() => {
  fakeDb.reset();
});

afterAll(async () => {
  await app.close();
  mock.restore();
  void mock.module('@/db/client.js', () => realDb);
});

const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ headers: { authorization }, method, payload, url });

describe('routes.clock round trip', () => {
  it('clocks in, reads the current clock, clocks out and lists the closed clock', async () => {
    fakeDb.enqueue([openRow], []);
    const opened = await call('POST', '/v1/clocks/in', { note: 'Morning' });
    expect(opened.statusCode).toBe(200);
    const inBody = opened.json<ReplyEnvelope<ClockResponse>>();
    expect(inBody.data.clock).toMatchObject({
      clocked_out_at: null,
      duration_ms: null,
      note: 'Morning',
      object: 'clock',
      source: 'clock',
      user_id: EMPLOYEE_ID,
    });
    expect(inBody.event).toMatchObject({
      code: 'clock.started',
      payload: { actor: EMPLOYEE_ID, clock_id: inBody.data.clock.id },
    });
    expect(inBody.event.correlation_id).toBeString();
    expect(fakeDb.calls.some((item) => item.op === 'insert' && item.method === 'values')).toBe(true);

    fakeDb.reset();
    fakeDb.enqueue([openRow]);
    const current = await call('GET', '/v1/clocks/current');
    expect(current.statusCode).toBe(200);
    const currentBody = current.json<ReplyEnvelope<CurrentResponse>>();
    expect(currentBody.data.clock).toMatchObject({ clocked_out_at: null, note: 'Morning' });
    expect(currentBody.event.code).toBe('clock.current.retrieved');

    fakeDb.reset();
    const stopped = { ...openRow, clocked_out_at: started + 3_600_000 };
    fakeDb.enqueue([openRow], [stopped], []);
    const closed = await call('POST', '/v1/clocks/out', {});
    expect(closed.statusCode).toBe(200);
    const outBody = closed.json<ReplyEnvelope<ClockResponse>>();
    expect(outBody.data.clock).toMatchObject({ duration_ms: 3_600_000, note: 'Morning' });
    expect(outBody.event.code).toBe('clock.stopped');

    fakeDb.reset();
    fakeDb.enqueue([stopped], [{ total: 1 }]);
    const listed = await call('POST', '/v1/clocks/list', { limit: 10, open: false });
    expect(listed.statusCode).toBe(200);
    const page = listed.json<ReplyEnvelope<{ items: unknown[]; more: boolean; total: number }>>();
    expect(page.data).toMatchObject({ more: false, next: null, total: 1 });
    expect(page.data.items).toHaveLength(1);
    expect(page.event.code).toBe('clock.listed');
    expect(JSON.stringify(page)).not.toContain('v1.');
  });

  it('answers a null clock when not clocked in', async () => {
    fakeDb.enqueue([]);
    const response = await call('GET', '/v1/clocks/current');
    expect(response.statusCode).toBe(200);
    expect(response.json<ReplyEnvelope<CurrentResponse>>().data).toEqual({ clock: null });
  });

  it('answers 409 clock.conflict when the open clock index is violated', async () => {
    fakeDb.enqueue(
      Object.assign(new Error('duplicate'), {
        code: '23505',
        constraint_name: 'clocks_user_id_open_idx',
      }),
    );
    const response = await call('POST', '/v1/clocks/in', {});
    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('clock.conflict');
  });

  it('answers 409 clock.conflict when clocking out without an open clock', async () => {
    fakeDb.enqueue([]);
    const response = await call('POST', '/v1/clocks/out', {});
    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('clock.conflict');
  });

  it('answers 400 clock.invalid when the open clock is older than 24 hours', async () => {
    fakeDb.enqueue([{ ...openRow, clocked_in_at: Date.now() - 25 * 3_600_000 }]);
    const response = await call('POST', '/v1/clocks/out', {});
    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('clock.invalid');
  });

  it('rejects an invalid body with validation.error', async () => {
    const response = await call('POST', '/v1/clocks/in', { note: '' });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('validation.error');
  });

  it('answers 404 clock.not.found for a clock of another user', async () => {
    fakeDb.enqueue([rowOf({ user_id: OTHER_ID })]);
    const response = await call('GET', '/v1/clocks/00000000-0000-4000-8000-0000000000f1');
    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('clock.not.found');
  });

  it('forbids an employee from creating a manual clock', async () => {
    const response = await call('POST', '/v1/clocks/new', {
      clocked_in_at: 1_700_000_000_000,
      clocked_out_at: 1_700_028_800_000,
      user_id: EMPLOYEE_ID,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('unauthorized');
  });
});
