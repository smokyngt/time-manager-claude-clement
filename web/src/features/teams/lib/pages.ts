import type { ListResponse } from '@time-manager/sdk'

import { LIMITS } from '@/config/limits'

export type AllItems<T> = { items: T[]; total: number }

export class Pages {
  /**
   * @route client.features.teams.pages.all
   * @param {(params: { cursor?: string; limit: number }) => Promise<ListResponse<T>>} fetchPage
   * @returns {Promise<AllItems<T>>} Every item, following the cursors.
   */
  static async all<T>(
    fetchPage: (params: { cursor?: string; limit: number }) => Promise<ListResponse<T>>,
  ): Promise<AllItems<T>> {
    const items: T[] = []
    let cursor: string | undefined
    let more = true
    while (more) {
      const page = await fetchPage({ cursor, limit: LIMITS.pageSize.max })
      items.push(...page.items)
      cursor = page.next ?? undefined
      more = page.more && cursor !== undefined
    }
    return { items, total: items.length }
  }
}
