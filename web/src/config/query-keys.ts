import type { QueryKey } from '@tanstack/react-query'

type Params = Record<string, unknown>

function withParams(base: QueryKey, params: Params | undefined): QueryKey {
  return params === undefined ? base : [...base, params]
}

export class QueryKeys {
  /**
   * @route client.config.queryKeys.clocks
   * @param {Params} filters Omit to match every clock list.
   * @returns {QueryKey}
   */
  static clocks(filters?: Params): QueryKey {
    return withParams(['clocks', 'list'], filters)
  }

  /**
   * @route client.config.queryKeys.clocksAll
   * @returns {QueryKey} Prefix of every clock key (lists and current).
   */
  static clocksAll(): QueryKey {
    return ['clocks']
  }

  /**
   * @route client.config.queryKeys.currentClock
   * @returns {QueryKey}
   */
  static currentClock(): QueryKey {
    return ['clocks', 'current']
  }

  /**
   * @route client.config.queryKeys.me
   * @returns {QueryKey}
   */
  static me(): QueryKey {
    return ['me']
  }

  /**
   * @route client.config.queryKeys.reportsAll
   * @returns {QueryKey} Prefix of every report key.
   */
  static reportsAll(): QueryKey {
    return ['reports']
  }

  /**
   * @route client.config.queryKeys.team
   * @param {string} id
   * @returns {QueryKey} Prefix of the team detail and its members.
   */
  static team(id: string): QueryKey {
    return ['teams', 'detail', id]
  }

  /**
   * @route client.config.queryKeys.teamMembers
   * @param {string} id Team id.
   * @param {Params} filters Omit to match every member list of the team.
   * @returns {QueryKey}
   */
  static teamMembers(id: string, filters?: Params): QueryKey {
    return withParams(['teams', 'detail', id, 'members'], filters)
  }

  /**
   * @route client.config.queryKeys.teamReport
   * @param {Params} params Team id, range and granularity.
   * @returns {QueryKey}
   */
  static teamReport(params?: Params): QueryKey {
    return withParams(['reports', 'team'], params)
  }

  /**
   * @route client.config.queryKeys.teams
   * @param {Params} filters Omit to match every team list.
   * @returns {QueryKey}
   */
  static teams(filters?: Params): QueryKey {
    return withParams(['teams', 'list'], filters)
  }

  /**
   * @route client.config.queryKeys.teamsAll
   * @returns {QueryKey} Prefix of every team key (lists, details, members).
   */
  static teamsAll(): QueryKey {
    return ['teams']
  }

  /**
   * @route client.config.queryKeys.user
   * @param {string} id
   * @returns {QueryKey}
   */
  static user(id: string): QueryKey {
    return ['users', 'detail', id]
  }

  /**
   * @route client.config.queryKeys.userReport
   * @param {Params} params User id, range and granularity.
   * @returns {QueryKey}
   */
  static userReport(params?: Params): QueryKey {
    return withParams(['reports', 'user'], params)
  }

  /**
   * @route client.config.queryKeys.users
   * @param {Params} filters Omit to match every user list.
   * @returns {QueryKey}
   */
  static users(filters?: Params): QueryKey {
    return withParams(['users', 'list'], filters)
  }

  /**
   * @route client.config.queryKeys.usersAll
   * @returns {QueryKey} Prefix of every user key (lists and details).
   */
  static usersAll(): QueryKey {
    return ['users']
  }
}
