import type { UserReportParams } from '@time-manager/sdk'

import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useUserReport(params: UserReportParams, enabled = true) {
  const query = useQuery({
    enabled,
    meta: { suppressError: true },
    queryFn: async () => (await sdk.reports.user(params)).report,
    queryKey: QueryKeys.userReport({ ...params }),
  })

  return {
    error: query.error,
    isError: query.isError,
    loading: query.isLoading,
    refetch: query.refetch,
    report: query.data,
  }
}
