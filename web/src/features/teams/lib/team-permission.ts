import type { Scope, Team, User } from '@time-manager/sdk'

import { Permission } from '@/lib/permission'
import { RESOURCE_SCOPES } from '@/lib/scopes'

const MANAGE = [RESOURCE_SCOPES.teams.manage]

export class TeamPermission {
  /**
   * @route client.features.teams.teamPermission.canCreate
   * @param {Scope[]} scopes
   * @returns {boolean}
   */
  static canCreate(scopes: readonly Scope[]): boolean {
    return Permission.scope.any(scopes, MANAGE)
  }

  /**
   * @route client.features.teams.teamPermission.canDelete
   * @param {Scope[]} scopes
   * @param {User | null} user
   * @returns {boolean} Deleting is reserved to administrators.
   */
  static canDelete(scopes: readonly Scope[], user: null | User): boolean {
    return Permission.scope.any(scopes, MANAGE) && user?.role === 'admin'
  }

  /**
   * @route client.features.teams.teamPermission.canManage
   * @param {Scope[]} scopes
   * @param {User | null} user
   * @param {Team} team
   * @returns {boolean} Administrators manage every team, managers the teams they own.
   */
  static canManage(
    scopes: readonly Scope[],
    user: null | User,
    team: Pick<Team, 'managerId'>,
  ): boolean {
    if (user === null || !Permission.scope.any(scopes, MANAGE)) {
      return false
    }
    return user.role === 'admin' || team.managerId === user.id
  }

  /**
   * @route client.features.teams.teamPermission.canPickManager
   * @param {User | null} user
   * @returns {boolean}
   */
  static canPickManager(user: null | User): boolean {
    return user?.role === 'admin'
  }
}
