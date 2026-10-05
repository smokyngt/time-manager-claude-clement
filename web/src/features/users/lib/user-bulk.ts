import type { BulkFailure, BulkUpdateResponse } from '@time-manager/sdk'

import { TimeManagerError } from '@time-manager/sdk'

export class UserBulk {
  /**
   * @route client.features.users.userBulk.reasons
   * @param {readonly BulkFailure[]} failed
   * @param {(code: string) => string} translate
   * @returns {string} Distinct translated failure reasons.
   */
  static reasons(failed: readonly BulkFailure[], translate: (code: string) => string): string {
    return [...new Set(failed.map((item) => translate(item.code)))].join(' ')
  }

  /**
   * @route client.features.users.userBulk.run
   * @param {readonly string[]} ids
   * @param {(id: string) => Promise<unknown>} operation One request per id.
   * @returns {Promise<BulkUpdateResponse>}
   */
  static async run(
    ids: readonly string[],
    operation: (id: string) => Promise<unknown>,
  ): Promise<BulkUpdateResponse> {
    const settled = await Promise.allSettled(ids.map((id) => operation(id)))
    const updated: string[] = []
    const failed: BulkFailure[] = []
    settled.forEach((result, index) => {
      const id = ids[index]
      if (id === undefined) {
        return
      }
      if (result.status === 'fulfilled') {
        updated.push(id)
      } else {
        const code =
          result.reason instanceof TimeManagerError ? result.reason.code : 'internal.unexpected'
        failed.push({ code, id })
      }
    })
    return { failed, success: failed.length === 0, updated }
  }
}
