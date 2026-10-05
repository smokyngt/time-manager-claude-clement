import type { QueryClient } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'

export class UsersCache {
  /**
   * @route client.features.users.usersCache.invalidate
   * @param {QueryClient} queryClient
   * @returns {Promise<void>} Refetches user lists, details and team member lists.
   */
  static async invalidate(queryClient: QueryClient): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QueryKeys.usersAll() }),
      queryClient.invalidateQueries({ queryKey: QueryKeys.teamsAll() }),
    ])
  }
}
