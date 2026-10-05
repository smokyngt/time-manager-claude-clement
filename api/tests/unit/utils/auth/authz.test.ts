import { describe, expect, it } from 'bun:test';

import { Access } from '@/utils/auth/authz.js';

import { Fake } from '../../../support/fake.js';
import {
  ADMIN_ID,
  EMPLOYEE_ID,
  MANAGER_ID,
  OTHER_ID,
  actorOf,
} from '../../services/user/support.js';

describe('Access.context', () => {
  it('returns the actor and the scopes', () => {
    const actor = actorOf('admin');
    expect(Access.context(Fake.request({ actor, scopes: ['users:manage'] }))).toEqual({
      actor,
      scopes: ['users:manage'],
    });
  });

  it('throws token.authentication.failed without an actor', () => {
    expect(() => Access.context(Fake.request())).toThrow('token.authentication.failed');
  });
});

describe('Access.role.require', () => {
  it('returns the actor when the role is allowed', () => {
    const actor = actorOf('manager');
    expect(Access.role.require(Fake.request({ actor }), ['admin', 'manager'])).toBe(actor);
  });

  it('throws unauthorized otherwise', () => {
    expect(() =>
      Access.role.require(Fake.request({ actor: actorOf('employee') }), ['admin', 'manager']),
    ).toThrow('unauthorized');
  });
});

describe('Access.user.allow', () => {
  const admin = actorOf('admin');
  const manager = actorOf('manager');
  const employee = actorOf('employee');

  it('gives admins everything except self archive and delete', () => {
    expect(Access.user.allow(admin, 'delete', { id: OTHER_ID, role: 'manager' })).toBe(true);
    expect(Access.user.allow(admin, 'delete', { id: ADMIN_ID, role: 'admin' })).toBe(false);
    expect(Access.user.allow(admin, 'archive', { id: ADMIN_ID, role: 'admin' })).toBe(false);
    expect(Access.user.allow(admin, 'create', { role: 'admin' })).toBe(true);
  });

  it('limits managers to employees and themselves', () => {
    expect(Access.user.allow(manager, 'create', { role: 'employee' })).toBe(true);
    expect(Access.user.allow(manager, 'create', { role: 'manager' })).toBe(false);
    expect(Access.user.allow(manager, 'update', { id: OTHER_ID, role: 'employee' })).toBe(true);
    expect(Access.user.allow(manager, 'update', { id: ADMIN_ID, role: 'admin' })).toBe(false);
    expect(Access.user.allow(manager, 'read', { id: MANAGER_ID, role: 'manager' })).toBe(true);
    expect(Access.user.allow(manager, 'archive', { id: MANAGER_ID, role: 'manager' })).toBe(false);
    expect(Access.user.allow(manager, 'list')).toBe(true);
  });

  it('limits employees to reading and updating themselves', () => {
    expect(Access.user.allow(employee, 'read', { id: EMPLOYEE_ID, role: 'employee' })).toBe(true);
    expect(Access.user.allow(employee, 'update', { id: EMPLOYEE_ID, role: 'employee' })).toBe(true);
    expect(Access.user.allow(employee, 'read', { id: OTHER_ID, role: 'employee' })).toBe(false);
    expect(Access.user.allow(employee, 'list')).toBe(false);
    expect(Access.user.allow(employee, 'create', { role: 'employee' })).toBe(false);
  });
});

describe('Access.user.fields and reach', () => {
  it('restricts self updates to harmless fields', () => {
    const fields = Access.user.fields(actorOf('admin'), { id: ADMIN_ID, role: 'admin' });
    expect(fields).not.toContain('role');
    expect(fields).not.toContain('email');
  });

  it('lets admins change roles of others but not managers', () => {
    expect(Access.user.fields(actorOf('admin'), { id: OTHER_ID, role: 'employee' })).toContain(
      'role',
    );
    expect(
      Access.user.fields(actorOf('manager'), { id: OTHER_ID, role: 'employee' }),
    ).not.toContain('role');
    expect(Access.user.fields(actorOf('manager'), { id: ADMIN_ID, role: 'admin' })).toEqual([]);
  });

  it('only lets employees reach themselves', () => {
    expect(Access.user.reach(actorOf('employee'), EMPLOYEE_ID)).toBe(true);
    expect(Access.user.reach(actorOf('employee'), OTHER_ID)).toBe(false);
    expect(Access.user.reach(actorOf('manager'), OTHER_ID)).toBe(true);
  });
});
