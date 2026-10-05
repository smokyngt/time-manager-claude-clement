import { useInfiniteQuery } from '@tanstack/react-query'

import type { ClockPage } from '@/features/clocks/api/types'
import type { ClockFilters } from '@/features/clocks/hooks/query-keys'

import { listClocks } from '@/features/clocks/api/clocks'
import { clockListKey } from '@/features/clocks/hooks/query-keys'

const PAGE_SIZE = 25

export function useClocks(filters: ClockFilters, enabled = true) {
  return useInfiniteQuery({
    enabled,
    getNextPageParam: (last_page) => (last_page.more ? (last_page.next ?? undefined) : undefined),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }): Promise<ClockPage> =>
      listClocks({ ...filters, cursor: pageParam, limit: PAGE_SIZE, order: 'desc' }),
    queryKey: clockListKey(filters),
  })
}
