import { useQuery } from '@tanstack/react-query'

import { LIMITS } from '@/config/limits'
import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export type UserOption = { id: string; label: string }

const EMPTY: UserOption[] = []

export function useClockUsers(enabled: boolean) {
  const query = useQuery({
    enabled,
    meta: { suppressError: true },
    queryFn: async () => {
      const items: UserOption[] = []
      let cursor: string | undefined
      let more = true
      while (more) {
        const page = await sdk.users.list({
          archived: false,
          cursor,
          limit: LIMITS.pageSize.max,
        })
        page.items.forEach((user) => {
          items.push({ id: user.id, label: `${user.firstName} ${user.lastName}` })
        })
        more = page.more && page.next !== null
        cursor = page.next ?? undefined
      }
      return { items, total: items.length }
    },
    queryKey: QueryKeys.users({ archived: false, purpose: 'clock-options' }),
  })

  return { loading: query.isPending && enabled, users: query.data?.items ?? EMPTY }
}
