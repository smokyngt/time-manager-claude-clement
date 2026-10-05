import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import {
  ADMIN_ID,
  caught,
  EMPLOYEE_ID,
  makeActor,
  makeRow,
  MISSING_ID,
  OTHER_ID,
} from '../../../helpers/fixtures.js';
import './conflict.js';
import { makeTeam, TEAM_ID } from './team.js';

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

const { add } = await import('@/services/team-member/add.js');

const admin = makeActor('admin');
const manager = makeActor('manager');

describe('team_member.service.add', () => {
  it('adds users, reports unknown and archived ones, and writes an audit log', async () => {
    fakeDb.enqueue(
      [makeTeam()],
      [makeRow({ id: OTHER_ID }), makeRow({ archived_at: 5, id: EMPLOYEE_ID })],
      [{ user_id: OTHER_ID }],
    );
    const result = await add({
      actor: manager,
      id: TEAM_ID,
      user_ids: [OTHER_ID, EMPLOYEE_ID, MISSING_ID, OTHER_ID],
    });
    expect(result).toEqual({
      added: [OTHER_ID],
      failed: [
        { code: 'TEAM_MEMBER_USER_ARCHIVED', id: EMPLOYEE_ID },
        { code: 'TEAM_MEMBER_USER_NOT_FOUND', id: MISSING_ID },
      ],
      success: false,
    });
    expect(logCreate).toHaveBeenCalledWith({
      actor: manager,
      event: 'team.members.added',
      metadata: { added: 1, failed: 2, team_id: TEAM_ID },
    });
  });

  it('lets an admin add a manager to any team', async () => {
    fakeDb.enqueue(
      [makeTeam()],
      [makeRow({ id: OTHER_ID, role: 'manager' })],
      [{ user_id: OTHER_ID }],
    );
    const result = await add({ actor: admin, id: TEAM_ID, user_ids: [OTHER_ID] });
    expect(result).toEqual({ added: [OTHER_ID], failed: [], success: true });
  });

  it('skips the insert when no user is eligible', async () => {
    fakeDb.enqueue([makeTeam()], []);
    const result = await add({ actor: admin, id: TEAM_ID, user_ids: [MISSING_ID] });
    expect(result.added).toEqual([]);
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('forbids a manager who does not manage the team', async () => {
    fakeDb.enqueue([makeTeam({ manager_id: ADMIN_ID })]);
    const error = await caught(add({ actor: manager, id: TEAM_ID, user_ids: [OTHER_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('forbids a manager from adding a non employee', async () => {
    fakeDb.enqueue([makeTeam()], [makeRow({ id: OTHER_ID, role: 'manager' })]);
    const error = await caught(add({ actor: manager, id: TEAM_ID, user_ids: [OTHER_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('forbids an employee', async () => {
    fakeDb.enqueue([makeTeam()]);
    const error = await caught(
      add({ actor: makeActor('employee'), id: TEAM_ID, user_ids: [OTHER_ID] }),
    );
    expect(error.code).toBe('FORBIDDEN');
  });

  it('throws TEAM_MEMBER_TEAM_NOT_FOUND for an unknown team', async () => {
    fakeDb.enqueue([]);
    const error = await caught(add({ actor: admin, id: MISSING_ID, user_ids: [OTHER_ID] }));
    expect(error.code).toBe('TEAM_MEMBER_TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('throws a conflict for an archived team', async () => {
    fakeDb.enqueue([makeTeam({ archived_at: 10 })]);
    const error = await caught(add({ actor: admin, id: TEAM_ID, user_ids: [OTHER_ID] }));
    expect(error.code).toBe('TEAM_MEMBER_TEAM_ARCHIVED');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(add({ actor: admin, id: TEAM_ID, user_ids: [OTHER_ID] }));
    expect(error.code).toBe('TEAM_MEMBER_ADD_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team_member.service.add');
  });
});
