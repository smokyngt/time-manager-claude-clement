import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor, MANAGER_ID } from '../../../helpers/fixtures.js';
import { makeTeamRow, TEAM_ID } from './fixtures.js';

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

const actor = makeActor('admin');
const data = { manager_id: MANAGER_ID, name: 'Support' };

describe('team.service.create', () => {
  it('creates a team with defaults and writes an audit log', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'manager' }], [makeTeamRow()]);
    const { team } = await create({ actor, data });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['work_start']).toBe('09:00');
    expect(values['work_end']).toBe('17:00');
    expect(values['weekly_hours_target']).toBe(35);
    expect(values['description']).toBeNull();
    expect(team.object).toBe('team');
    expect(team.member_count).toBe(0);
    expect(logCreate).toHaveBeenCalledTimes(1);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'team.created',
      metadata: { manager_id: MANAGER_ID, team_id: TEAM_ID },
    });
  });

  it('rejects an employee as manager', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'employee' }]);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('TEAM_MANAGER_INVALID');
    expect(error.status).toBe(400);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('rejects an archived or unknown manager', async () => {
    fakeDb.enqueue([{ archived_at: 1, role: 'manager' }]);
    const archived = await caught(create({ actor, data }));
    fakeDb.enqueue([]);
    const unknown = await caught(create({ actor, data }));
    expect(archived.code).toBe('TEAM_MANAGER_INVALID');
    expect(unknown.code).toBe('TEAM_MANAGER_INVALID');
  });

  it('rejects a working day that ends before it starts', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'admin' }]);
    const error = await caught(
      create({ actor, data: { ...data, work_end: '08:00', work_start: '09:00' } }),
    );
    expect(error.code).toBe('TEAM_SCHEDULE_INVALID');
    expect(error.status).toBe(400);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue([{ archived_at: null, role: 'manager' }], failure);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('TEAM_CREATE_ERROR');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.service.create');
  });

  it('fails when the insert returns no row', async () => {
    fakeDb.enqueue([{ archived_at: null, role: 'manager' }], []);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('TEAM_CREATE_ERROR');
  });
});
