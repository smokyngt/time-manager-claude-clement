import { useQuery } from '@tanstack/react-query'

import { getCurrentClock } from '@/features/clocks/api/clocks'
import { CURRENT_CLOCK_QUERY_KEY } from '@/features/clocks/hooks/query-keys'

export function useCurrentClock() {
  return useQuery({ queryFn: getCurrentClock, queryKey: CURRENT_CLOCK_QUERY_KEY })
}
