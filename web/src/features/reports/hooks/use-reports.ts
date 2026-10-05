import { useQuery } from '@tanstack/react-query'

import type { TeamReportParams, UserReportParams } from '@/features/reports/api/types'

import { fetchTeamReport, fetchUserReport } from '@/features/reports/api/reports'

export function useTeamReport(params: null | TeamReportParams) {
  return useQuery({
    enabled: params !== null,
    queryFn: () => fetchTeamReport(params as TeamReportParams),
    queryKey: ['reports', 'team', params],
  })
}

export function useUserReport(params: null | UserReportParams) {
  return useQuery({
    enabled: params !== null,
    queryFn: () => fetchUserReport(params as UserReportParams),
    queryKey: ['reports', 'user', params],
  })
}
