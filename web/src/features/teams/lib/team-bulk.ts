import type { BulkFailure } from '@time-manager/sdk'

import { ErrorCodes, TimeManagerError } from '@time-manager/sdk'

export class TeamBulk {
  /**
   * @route client.features.teams.teamBulk.assertSome
   * @param {number} succeeded Number of ids that were processed.
   * @param {BulkFailure[]} failed
   * @returns {void} Throws the first failure when nothing succeeded.
   */
  static assertSome(succeeded: number, failed: readonly BulkFailure[]): void {
    const first = failed[0]
    if (succeeded === 0 && first !== undefined) {
      throw new TimeManagerError({ code: first.code || ErrorCodes.TeamUpdateFailed, status: 400 })
    }
  }
}
