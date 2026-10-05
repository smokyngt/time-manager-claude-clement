import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useCurrentClock() {
  const query = useQuery({
    meta: { suppressError: true },
    queryFn: async () => (await sdk.clocks.current()).clock,
    queryKey: QueryKeys.currentClock(),
  })

  return {
    clock: query.data ?? null,
    error: query.error,
    isError: query.isError,
    loaded: query.isSuccess,
    loading: query.isPending,
    refetch: query.refetch,
  }
}
