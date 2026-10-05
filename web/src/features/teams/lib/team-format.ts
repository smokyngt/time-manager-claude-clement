import type { Team, User } from '@time-manager/sdk'

export class TeamFormat {
  /**
   * @route client.features.teams.teamFormat.schedule
   * @param {Team} team
   * @returns {string} For example `09:00–17:00`.
   */
  static schedule(team: Pick<Team, 'workEnd' | 'workStart'>): string {
    return `${team.workStart}–${team.workEnd}`
  }

  /**
   * @route client.features.teams.teamFormat.userName
   * @param {User} user
   * @returns {string}
   */
  static userName(user: Pick<User, 'firstName' | 'lastName'>): string {
    return `${user.firstName} ${user.lastName}`.trim()
  }
}
