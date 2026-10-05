import type { Role } from '@/types/entities/user.js';

import type { Scope } from './scopes.js';

export const ROLE_SCOPES: Record<Role, readonly Scope[]> = {
  admin: ['auth:self', 'users:manage', 'users:read', 'users:write'],
  employee: ['auth:self', 'users:read', 'users:write'],
  manager: ['auth:self', 'users:manage', 'users:read', 'users:write'],
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
