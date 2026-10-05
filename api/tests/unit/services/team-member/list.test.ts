import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import {
  ADMIN_ID,
  caught,
  EMPLOYEE_ID,
  makeActor,
  makeRow,
  MISSING_ID,
} from '../../../helpers/fixtures.js';
import { makeTeam, TEAM_ID } from './team.js';

const realDb = { ...(await import('@/db/client.js')) };
const realCursor = { ...(await import('@/utils/cursor.js')) };
const fakeDb = new FakeDb();
const paginate = mock(() =>
  Promise.resolve({ items: [makeRow()], more: true, next: 'abc', total: 5 }),
);
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
await mock.module('@/utils/cursor.js', () => ({ ...realCursor, Cursor: { paginate } }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  void mock.module('@/utils/cursor.js', () => realCursor);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { list } = await import('@/services/team-member/list.js');

const base = { id: TEAM_ID, limit: 10, order: 'desc' } as const;

describe('team_member.service.list', () => {
  it('paginates the members of the team for an admin', async () => {
    fakeDb.enqueue([makeTeam()]);
    const result = await list({ ...base, actor: makeActor('admin') });
    expect(result.more).toBe(true);
    expect(result.next).toBe('abc');
    expect(result.total).toBe(5);
    expect(result.items[0]?.object).toBe('user');
    expect(Object.keys(result.items[0] ?? {})).not.toContain('password_hash');
    const calls = paginate.mock.calls as unknown as [unknown, Record<string, unknown>][];
    expect(calls[0]?.[1]).toMatchObject({ limit: 10, order: 'desc', sort: 'created_at' });
    expect(calls[0]?.[1]['filters']).toBeDefined();
  });

  it('lets the manager of the team list without a membership lookup', async () => {
    fakeDb.enqueue([makeTeam()]);
    await list({ ...base, actor: makeActor('manager') });
    expect(paginate).toHaveBeenCalledTimes(1);
  });

  it('lets a member list the team', async () => {
    fakeDb.enqueue([makeTeam()], [{ user_id: EMPLOYEE_ID }]);
    await list({ ...base, actor: makeActor('employee') });
    expect(paginate).toHaveBeenCalledTimes(1);
  });

  it('forbids a user who is not in the team', async () => {
    fakeDb.enqueue([makeTeam()], []);
    const error = await caught(list({ ...base, actor: makeActor('employee') }));
    expect(error.code).toBe('FORBIDDEN');
    expect(paginate).not.toHaveBeenCalled();
  });

  it('forbids a manager of another team', async () => {
    fakeDb.enqueue([makeTeam({ manager_id: ADMIN_ID })], []);
    const error = await caught(list({ ...base, actor: makeActor('manager') }));
    expect(error.code).toBe('FORBIDDEN');
  });

  it('throws TEAM_MEMBER_TEAM_NOT_FOUND for an unknown team', async () => {
    fakeDb.enqueue([]);
    const error = await caught(list({ ...base, actor: makeActor('admin'), id: MISSING_ID }));
    expect(error.code).toBe('TEAM_MEMBER_TEAM_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue([makeTeam()]);
    paginate.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(list({ ...base, actor: makeActor('admin') }));
    expect(error.code).toBe('TEAM_MEMBER_LIST_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team_member.service.list');
  });

  it('keeps a validation error raised by the cursor', async () => {
    const { ValidationError } = await import('@/lib/errors/index.js');
    fakeDb.enqueue([makeTeam()]);
    paginate.mockImplementationOnce(() => Promise.reject(ValidationError()));
    const error = await caught(list({ ...base, actor: makeActor('admin'), cursor: 'bad' }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
  });
});
