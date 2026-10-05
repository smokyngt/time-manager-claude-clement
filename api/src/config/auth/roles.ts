import type { Scope } from './scopes.js';
import type { Role } from '@/types/entities/user.js';

export const ROLE_SCOPES: Record<Role, readonly Scope[]> = {
  admin: [
    'auth:self',
    'clocks:manage',
    'clocks:read',
    'clocks:write',
    'reports:read',
    'teams:manage',
    'teams:read',
    'users:manage',
    'users:read',
    'users:write',
  ],
  employee: [
    'auth:self',
    'clocks:read',
    'clocks:write',
    'reports:read',
    'teams:read',
    'users:read',
    'users:write',
  ],
  manager: [
    'auth:self',
    'clocks:manage',
    'clocks:read',
    'clocks:write',
    'reports:read',
    'teams:manage',
    'teams:read',
    'users:manage',
    'users:read',
    'users:write',
  ],
};

export class Roles {
  /**
   * @route config.roles.scopes
   * @param {Role} role
   * @returns {readonly Scope[]}
   */
  public static scopes(role: Role): readonly Scope[] {
    return ROLE_SCOPES[role];
  }
}
