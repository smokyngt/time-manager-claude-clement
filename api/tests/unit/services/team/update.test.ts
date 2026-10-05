import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { actorOf, caught, MANAGER_ID, MISSING_ID, OTHER_MANAGER_ID, rowOf, TEAM_ID } from './support.js';

const realDb = { ...(await import('@/db/client.js')) };
const realLog = { ...(await import('@/services/log/index.js')) };
const fakeDb = new FakeDb();
const logCreate = mock(() => Promise.resolve({ success: true }));
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
await mock.module('@/services/log/index.js', () => ({
  ...realLog,
  logService: { create: logCreate },
}));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  void mock.module('@/services/log/index.js', () => realLog);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { update } = await import('@/services/team/update.js');
const { Cipher } = await import('@/utils/crypto/cipher.js');

const actor = actorOf('admin');

describe('team.service.update', () => {
  it('seals name and description and writes an audit log', async () => {
    fakeDb.enqueue([rowOf()], [{ total: 2 }]);
    const { team } = await update({
      actor,
      data: { description: 'New description', name: 'Customer care' },
      id: TEAM_ID,
    });
    const values = fakeDb.arg('update', 'set') as Record<string, string>;
    expect(Cipher.open(values['name'] ?? '')).toBe('Customer care');
    expect(Cipher.open(values['description'] ?? '')).toBe('New description');
    expect(typeof values['updated_at']).toBe('number');
    expect(team.member_count).toBe(2);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'team.updated',
      metadata: { fields: ['description', 'name'], team_id: TEAM_ID },
    });
  });

  it('clears the description with null', async () => {
    fakeDb.enqueue([rowOf({ description: null })], [{ total: 0 }]);
    await update({ actor, data: { description: null }, id: TEAM_ID });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(values['description']).toBeNull();
  });

  it('validates the new manager', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'employee' }]);
    const error = await caught(update({ actor, data: { manager_id: MANAGER_ID }, id: TEAM_ID }));
    expect(error.code).toBe('team.manager.invalid');
    expect(error.status).toBe(400);
  });

  it('accepts an active manager', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'manager' }], [rowOf({ manager_id: OTHER_MANAGER_ID })], [{ total: 1 }]);
    const { team } = await update({ actor, data: { manager_id: OTHER_MANAGER_ID }, id: TEAM_ID });
    expect(team.manager_id).toBe(OTHER_MANAGER_ID);
  });

  it('checks the schedule against the stored values', async () => {
    fakeDb.enqueue([{ work_end: '17:00', work_start: '09:00' }]);
    const error = await caught(update({ actor, data: { work_start: '18:00' }, id: TEAM_ID }));
    expect(error.code).toBe('team.schedule.invalid');
    expect(error.status).toBe(400);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('accepts a valid schedule change', async () => {
    fakeDb.enqueue([{ work_end: '17:00', work_start: '09:00' }], [rowOf({ work_start: '08:00' })], [{ total: 1 }]);
    const { team } = await update({ actor, data: { work_start: '08:00' }, id: TEAM_ID });
    expect(team.work_start).toBe('08:00');
  });

  it('throws team.not.found when the schedule lookup finds nothing', async () => {
    fakeDb.enqueue([]);
    const error = await caught(update({ actor, data: { work_end: '18:00' }, id: MISSING_ID }));
    expect(error.code).toBe('team.not.found');
  });

  it('throws team.not.found when nothing matches', async () => {
    fakeDb.enqueue([]);
    const error = await caught(update({ actor, data: { name: 'X' }, id: MISSING_ID }));
    expect(error.code).toBe('team.not.found');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(update({ actor, data: { name: 'X' }, id: TEAM_ID }));
    expect(error.code).toBe('team.update.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.update');
  });
});
