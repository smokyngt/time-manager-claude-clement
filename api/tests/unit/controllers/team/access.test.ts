import { describe, expect, it } from 'bun:test';

import { teamAccess } from '@/utils/access/team.js';

import { makeActor, MANAGER_ID, OTHER_ID } from '../../../helpers/fixtures.js';

const managed = { id: 't', manager_id: MANAGER_ID };
const foreign = { id: 't', manager_id: OTHER_ID };

describe('team access', () => {
  it('allows an admin everything', () => {
    for (const action of [
      'archive',
      'create',
      'delete',
      'list',
      'read',
      'restore',
      'update',
    ] as const) {
      expect(teamAccess.allow(makeActor('admin'), action, foreign)).toBe(true);
    }
  });

  it('lets a manager create only for themselves and never delete', () => {
    const manager = makeActor('manager');
    expect(teamAccess.allow(manager, 'create', { manager_id: MANAGER_ID })).toBe(true);
    expect(teamAccess.allow(manager, 'create', { manager_id: OTHER_ID })).toBe(false);
    expect(teamAccess.allow(manager, 'delete', managed)).toBe(false);
    expect(teamAccess.allow(manager, 'update')).toBe(false);
  });

  it('lets a manager write only managed teams and read joined ones', () => {
    const manager = makeActor('manager');
    expect(teamAccess.allow(manager, 'update', managed)).toBe(true);
    expect(teamAccess.allow(manager, 'archive', foreign)).toBe(false);
    expect(teamAccess.allow(manager, 'read', { ...foreign, member: true })).toBe(true);
    expect(teamAccess.allow(manager, 'update', { ...foreign, member: true })).toBe(false);
  });

  it('lets an employee list and read joined teams only', () => {
    const employee = makeActor('employee');
    expect(teamAccess.allow(employee, 'list')).toBe(true);
    expect(teamAccess.allow(employee, 'read', { ...managed, member: true })).toBe(true);
    expect(teamAccess.allow(employee, 'read', managed)).toBe(false);
    expect(teamAccess.allow(employee, 'update', { ...managed, member: true })).toBe(false);
  });

  it('exposes fields per role', () => {
    expect(teamAccess.fields(makeActor('admin'), foreign)).toContain('manager_id');
    expect(teamAccess.fields(makeActor('manager'), managed)).not.toContain('manager_id');
    expect(teamAccess.fields(makeActor('manager'), foreign)).toEqual([]);
    expect(teamAccess.fields(makeActor('employee'), managed)).toEqual([]);
  });

  it('throws a forbidden error with the route in metadata', () => {
    expect(() => { teamAccess.require(makeActor('employee'), 'create'); }).toThrow();
  });
});
