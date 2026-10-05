import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { ADMIN_ID, caught, makeActor, MISSING_ID, OTHER_ID } from '../../../helpers/fixtures.js';
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

const { remove } = await import('@/services/team-member/remove.js');

const admin = makeActor('admin');
const manager = makeActor('manager');

describe('team_member.service.remove', () => {
  it('removes members, reports non members and writes an audit log', async () => {
    fakeDb.enqueue([makeTeam()], [{ user_id: OTHER_ID }]);
    const result = await remove({
      actor: manager,
      id: TEAM_ID,
      user_ids: [OTHER_ID, MISSING_ID, OTHER_ID],
    });
    expect(result).toEqual({
      failed: [{ code: 'TEAM_MEMBER_NOT_FOUND', id: MISSING_ID }],
      removed: [OTHER_ID],
      success: false,
    });
    expect(logCreate).toHaveBeenCalledWith({
      actor: manager,
      event: 'team.members.removed',
      metadata: { failed: 1, removed: 1, team_id: TEAM_ID },
    });
  });

  it('lets an admin remove from any team', async () => {
    fakeDb.enqueue([makeTeam({ manager_id: ADMIN_ID })], [{ user_id: OTHER_ID }]);
    const result = await remove({ actor: admin, id: TEAM_ID, user_ids: [OTHER_ID] });
    expect(result).toEqual({ failed: [], removed: [OTHER_ID], success: true });
  });

  it('forbids a manager who does not manage the team', async () => {
    fakeDb.enqueue([makeTeam({ manager_id: ADMIN_ID })]);
    const error = await caught(remove({ actor: manager, id: TEAM_ID, user_ids: [OTHER_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('throws TEAM_MEMBER_TEAM_NOT_FOUND for an unknown team', async () => {
    fakeDb.enqueue([]);
    const error = await caught(remove({ actor: admin, id: MISSING_ID, user_ids: [OTHER_ID] }));
    expect(error.code).toBe('TEAM_MEMBER_TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue([makeTeam()], failure);
    const error = await caught(remove({ actor: manager, id: TEAM_ID, user_ids: [OTHER_ID] }));
    expect(error.code).toBe('TEAM_MEMBER_REMOVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team_member.service.remove');
  });
});
