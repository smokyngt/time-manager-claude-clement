import type { TeamReportParams } from '@time-manager/sdk'

import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useTeamReport(params: TeamReportParams, enabled = true) {
  const query = useQuery({
    enabled,
    meta: { suppressError: true },
    queryFn: async () => (await sdk.reports.team(params)).report,
    queryKey: QueryKeys.teamReport({ ...params }),
  })

  return {
    error: query.error,
    isError: query.isError,
    loading: query.isLoading,
    refetch: query.refetch,
    report: query.data,
  }
}
