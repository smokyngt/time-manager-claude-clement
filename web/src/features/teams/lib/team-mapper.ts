import type { Team, TeamCreateParams, TeamUpdateData } from '@time-manager/sdk'

import type { TeamValues } from '@/features/teams/lib/team-schema'

export class TeamMapper {
  /**
   * @route client.features.teams.teamMapper.defaults
   * @param {string} managerId Initial manager, the signed-in user.
   * @returns {TeamValues}
   */
  static defaults(managerId: string): TeamValues {
    return {
      description: '',
      managerId,
      name: '',
      weeklyHoursTarget: 35,
      workEnd: '17:00',
      workStart: '09:00',
    }
  }

  /**
   * @route client.features.teams.teamMapper.fromTeam
   * @param {Team} team
   * @returns {TeamValues}
   */
  static fromTeam(team: Team): TeamValues {
    return {
      description: team.description ?? '',
      managerId: team.managerId,
      name: team.name,
      weeklyHoursTarget: team.weeklyHoursTarget,
      workEnd: team.workEnd,
      workStart: team.workStart,
    }
  }

  /**
   * @route client.features.teams.teamMapper.snapshot
   * @param {Team} team
   * @returns {TeamUpdateData} Every editable field of the team, used to undo an update.
   */
  static snapshot(team: Team): TeamUpdateData {
    return {
      description: team.description,
      managerId: team.managerId,
      name: team.name,
      weeklyHoursTarget: team.weeklyHoursTarget,
      workEnd: team.workEnd,
      workStart: team.workStart,
    }
  }

  /**
   * @route client.features.teams.teamMapper.toCreate
   * @param {TeamValues} values
   * @param {boolean} withManager True when the user may choose the manager.
   * @returns {TeamCreateParams}
   */
  static toCreate(values: TeamValues, withManager: boolean): TeamCreateParams {
    return {
      ...(values.description === '' ? {} : { description: values.description }),
      ...(withManager ? { managerId: values.managerId } : {}),
      name: values.name,
      weeklyHoursTarget: values.weeklyHoursTarget,
      workEnd: values.workEnd,
      workStart: values.workStart,
    }
  }

  /**
   * @route client.features.teams.teamMapper.toUpdate
   * @param {TeamValues} values
   * @param {Team} team Team before the edit.
   * @param {boolean} withManager True when the user may change the manager.
   * @returns {TeamUpdateData}
   */
  static toUpdate(values: TeamValues, team: Team, withManager: boolean): TeamUpdateData {
    return {
      description: values.description === '' ? null : values.description,
      ...(withManager && values.managerId !== team.managerId ? { managerId: values.managerId } : {}),
      name: values.name,
      weeklyHoursTarget: values.weeklyHoursTarget,
      workEnd: values.workEnd,
      workStart: values.workStart,
    }
  }
}
