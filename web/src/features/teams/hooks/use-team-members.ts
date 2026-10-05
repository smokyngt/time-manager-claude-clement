import type { TeamMember } from '@time-manager/sdk'

import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { Pages } from '@/features/teams/lib/pages'

const NO_MEMBERS: TeamMember[] = []

export function useTeamMembers(teamId: string, enabled = true) {
  const query = useQuery({
    enabled: enabled && teamId !== '',
    meta: { suppressError: true },
    queryFn: () => Pages.all((page) => sdk.teamMembers.list(teamId, page)),
    queryKey: QueryKeys.teamMembers(teamId),
  })

  return {
    error: query.error,
    isError: query.isError,
    loaded: query.isSuccess,
    loading: query.isPending && query.fetchStatus !== 'idle',
    members: query.data?.items ?? NO_MEMBERS,
    refetch: query.refetch,
    total: query.data?.total ?? 0,
  }
}
