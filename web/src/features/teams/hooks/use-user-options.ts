import type { Role, User } from '@time-manager/sdk'

import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { Pages } from '@/features/teams/lib/pages'

const NO_USERS: User[] = []

export function useUserOptions(roles: readonly Role[], enabled = true) {
  const query = useQuery({
    enabled,
    meta: { suppressError: true },
    queryFn: async () => {
      const groups = await Promise.all(
        roles.map((role) =>
          Pages.all((page) => sdk.users.list({ archived: false, role, ...page })),
        ),
      )
      return groups.flatMap((group) => group.items)
    },
    queryKey: QueryKeys.users({ roles, scope: 'team-options' }),
  })

  return {
    error: query.error,
    isError: query.isError,
    loaded: query.isSuccess,
    loading: query.isPending && query.fetchStatus !== 'idle',
    refetch: query.refetch,
    users: query.data ?? NO_USERS,
  }
}
