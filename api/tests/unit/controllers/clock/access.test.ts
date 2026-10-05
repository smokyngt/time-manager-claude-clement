import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, OTHER_ID } from '../../../helpers/fixtures.js';
import { installMembership } from './harness.js';

const membership = await installMembership();
const { managed } = membership;

afterAll(() => {
  membership.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  managed.clear();
});

const { ClockAccess } = await import('@/utils/access/clock.js');

const access = new ClockAccess();

describe('clock.access', () => {
  it('allows an admin everything', async () => {
    for (const action of ['create', 'delete', 'read', 'update'] as const) {
      expect(await access.allow(makeActor('admin'), action, { user_id: OTHER_ID })).toBe(true);
    }
  });

  it('lets an employee read only their own clocks and never write', async () => {
    const actor = makeActor('employee');
    expect(await access.allow(actor, 'read', { user_id: actor.id })).toBe(true);
    expect(await access.allow(actor, 'read', { user_id: OTHER_ID })).toBe(false);
    expect(await access.allow(actor, 'update', { user_id: actor.id })).toBe(false);
    expect(await access.allow(actor, 'delete', { user_id: actor.id })).toBe(false);
  });

  it('limits a manager to managed users for writes', async () => {
    const actor = makeActor('manager');
    managed.add(OTHER_ID);
    expect(await access.allow(actor, 'update', { user_id: OTHER_ID })).toBe(true);
    expect(await access.allow(actor, 'update', { user_id: actor.id })).toBe(false);
    expect(await access.allow(actor, 'read', { user_id: actor.id })).toBe(true);
  });

  it('throws a forbidden error from require', async () => {
    const error = await caught(
      access.require(makeActor('employee'), 'create', { user_id: OTHER_ID }),
    );
    expect(error.code).toBe('FORBIDDEN');
    expect(error.metadata['route']).toBe('access.clock.require');
  });

  it('scopes the user ids by role', async () => {
    const employee = makeActor('employee');
    managed.add(OTHER_ID);
    expect(await access.users(employee, [OTHER_ID])).toEqual([employee.id]);
    expect(await access.users(makeActor('admin'))).toBeUndefined();
    expect(await access.users(makeActor('admin'), [OTHER_ID])).toEqual([OTHER_ID]);
  });
});
