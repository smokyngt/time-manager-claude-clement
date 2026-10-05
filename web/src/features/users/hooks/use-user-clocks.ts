import type { Clock } from '@time-manager/sdk'

import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

const EMPTY: Clock[] = []
const RECENT = 5

export function useUserClocks(userId: string | undefined, options: { enabled?: boolean } = {}) {
  const enabled = userId !== undefined && (options.enabled ?? true)
  const query = useQuery({
    enabled,
    queryFn: async () => (await sdk.clocks.list({ limit: RECENT, userIds: [userId!] })).items,
    queryKey: QueryKeys.clocks({ limit: RECENT, userIds: [userId] }),
  })

  return {
    clocks: query.data ?? EMPTY,
    isError: query.isError,
    loading: query.isPending && enabled,
    refetch: query.refetch,
  }
}
