import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor, MANAGER_ID } from '../../../helpers/fixtures.js';
import { makeTeamRow, MISSING_TEAM_ID, TEAM_ID } from './fixtures.js';

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

const actor = makeActor('admin');

describe('team.service.update', () => {
  it('updates fields and writes an audit log with field names only', async () => {
    fakeDb.enqueue([makeTeamRow({ name: 'Care' })], [{ id: TEAM_ID, total: 1 }]);
    const { team } = await update({
      actor,
      data: { description: null, name: 'Care', weekly_hours_target: 30 },
      id: TEAM_ID,
    });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(values['name']).toBe('Care');
    expect(values['description']).toBeNull();
    expect(values['weekly_hours_target']).toBe(30);
    expect(typeof values['updated_at']).toBe('number');
    expect(team.name).toBe('Care');
    expect(team.member_count).toBe(1);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'team.updated',
      metadata: { fields: ['description', 'name', 'weekly_hours_target'], team_id: TEAM_ID },
    });
  });

  it('validates a new manager', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'employee' }]);
    const error = await caught(update({ actor, data: { manager_id: MANAGER_ID }, id: TEAM_ID }));
    expect(error.code).toBe('TEAM_MANAGER_INVALID');
    expect(error.status).toBe(400);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('accepts a valid new manager', async () => {
    fakeDb.enqueue(
      [{ archived_at: null, role: 'admin' }],
      [makeTeamRow()],
      [{ id: TEAM_ID, total: 0 }],
    );
    await update({ actor, data: { manager_id: MANAGER_ID }, id: TEAM_ID });
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['manager_id']).toBe(MANAGER_ID);
  });

  it('compares a partial schedule with the stored one', async () => {
    fakeDb.enqueue([{ work_end: '17:00', work_start: '09:00' }]);
    const error = await caught(update({ actor, data: { work_start: '18:00' }, id: TEAM_ID }));
    expect(error.code).toBe('TEAM_SCHEDULE_INVALID');
    expect(error.status).toBe(400);
  });

  it('rejects an inverted schedule given in full', async () => {
    const error = await caught(
      update({ actor, data: { work_end: '08:00', work_start: '09:00' }, id: TEAM_ID }),
    );
    expect(error.code).toBe('TEAM_SCHEDULE_INVALID');
  });

  it('throws TEAM_NOT_FOUND when the stored schedule cannot be read', async () => {
    fakeDb.enqueue([]);
    const error = await caught(update({ actor, data: { work_end: '18:00' }, id: MISSING_TEAM_ID }));
    expect(error.code).toBe('TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('throws TEAM_NOT_FOUND when nothing matches', async () => {
    fakeDb.enqueue([]);
    const error = await caught(update({ actor, data: { name: 'A' }, id: MISSING_TEAM_ID }));
    expect(error.code).toBe('TEAM_NOT_FOUND');
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(update({ actor, data: { name: 'A' }, id: TEAM_ID }));
    expect(error.code).toBe('TEAM_UPDATE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.update');
  });
});
