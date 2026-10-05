import type { Clock } from '@time-manager/sdk'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { LIMITS } from '@/config/limits'
import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export type ClocksFilters = {
  cursor?: string
  from?: number
  to?: number
  userIds?: string[]
}

const EMPTY: Clock[] = []

export function useClocks(filters: ClocksFilters, enabled = true) {
  const params = { ...filters, limit: LIMITS.pageSize.default, order: 'desc' as const }
  const query = useQuery({
    enabled,
    meta: { suppressError: true },
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { items, more, next, total } = await sdk.clocks.list(params)
      return { items, more, next, total }
    },
    queryKey: QueryKeys.clocks(params),
  })

  return {
    clocks: query.data?.items ?? EMPTY,
    error: query.error,
    isError: query.isError,
    loaded: query.isSuccess,
    loading: query.isPending,
    more: query.data?.more ?? false,
    next: query.data?.next ?? null,
    refetch: query.refetch,
    total: query.data?.total ?? 0,
  }
}
