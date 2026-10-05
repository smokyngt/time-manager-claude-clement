import type { Role } from '@time-manager/sdk'

const MANAGER_ROLES: readonly Role[] = ['admin', 'manager']
const ALL_ROLES: readonly Role[] = ['admin', 'employee', 'manager']
const EMPLOYEE_ROLES: readonly Role[] = ['employee']

export class TeamRoles {
  /**
   * @route client.features.teams.teamRoles.managers
   * @returns {Role[]} Roles that can manage a team.
   */
  static managers(): readonly Role[] {
    return MANAGER_ROLES
  }

  /**
   * @route client.features.teams.teamRoles.memberCandidates
   * @param {Role | undefined} role Role of the signed-in user.
   * @returns {Role[]} Administrators add anyone, managers only employees.
   */
  static memberCandidates(role: Role | undefined): readonly Role[] {
    return role === 'admin' ? ALL_ROLES : EMPLOYEE_ROLES
  }
}
