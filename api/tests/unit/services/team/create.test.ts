import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { actorOf, caught, MANAGER_ID, rowOf, TEAM_ID } from './support.js';

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

const { create } = await import('@/services/team/create.js');
const { Cipher } = await import('@/utils/crypto/cipher.js');

const actor = actorOf('admin');
const data = {
  description: 'Customer support team of the Paris office.',
  manager_id: MANAGER_ID,
  name: 'Customer support',
};
const activeManager = [{ archived_at: null, role: 'manager' }];

describe('team.service.create', () => {
  it('seals name and description, applies defaults and writes an audit log', async () => {
    fakeDb.enqueue(activeManager, [rowOf()]);
    const { team } = await create({ actor, data });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(String(values['name'])).not.toContain('Customer');
    expect(Cipher.open(String(values['name']))).toBe('Customer support');
    expect(Cipher.open(String(values['description']))).toBe(
      'Customer support team of the Paris office.',
    );
    expect(values['manager_id']).toBe(MANAGER_ID);
    expect(values['work_start']).toBe('09:00');
    expect(values['work_end']).toBe('17:00');
    expect(team).toMatchObject({ member_count: 0, name: 'Customer support', object: 'team' });
    expect(logCreate).toHaveBeenCalledTimes(1);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'team.created',
      metadata: { manager_id: MANAGER_ID, team_id: TEAM_ID },
    });
  });

  it('stores a null description when none is given', async () => {
    fakeDb.enqueue(activeManager, [rowOf({ description: null })]);
    const { team } = await create({ actor, data: { manager_id: MANAGER_ID, name: 'Support' } });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['description']).toBeNull();
    expect(team.description).toBeNull();
  });

  it('rejects an employee, an archived user or an unknown user as manager', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'employee' }]);
    const employee = await caught(create({ actor, data }));
    fakeDb.enqueue([{ archived_at: 1, role: 'manager' }]);
    const archived = await caught(create({ actor, data }));
    fakeDb.enqueue([]);
    const unknown = await caught(create({ actor, data }));
    for (const error of [employee, archived, unknown]) {
      expect(error.code).toBe('team.manager.invalid');
      expect(error.status).toBe(400);
    }
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('rejects a working day that ends before it starts', async () => {
    fakeDb.enqueue(activeManager);
    const error = await caught(create({ actor, data: { ...data, work_end: '08:00', work_start: '09:00' } }));
    expect(error.code).toBe('team.schedule.invalid');
    expect(error.status).toBe(400);
  });

  it('checks the default start when only the end is given', async () => {
    fakeDb.enqueue(activeManager);
    const error = await caught(create({ actor, data: { ...data, work_end: '08:30' } }));
    expect(error.code).toBe('team.schedule.invalid');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(activeManager, failure);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('team.create.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.create');
  });

  it('fails when the insert returns no row', async () => {
    fakeDb.enqueue(activeManager, []);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('team.create.failed');
  });
});
