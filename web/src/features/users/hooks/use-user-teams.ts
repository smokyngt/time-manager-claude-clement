import type { Team } from '@time-manager/sdk'

import { useQuery } from '@tanstack/react-query'

import { LIMITS } from '@/config/limits'
import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

const EMPTY: Team[] = []

export function useUserTeams(userId: string | undefined) {
  const query = useQuery({
    enabled: userId !== undefined,
    queryFn: async () =>
      (await sdk.teams.list({ limit: LIMITS.pageSize.max, memberId: userId })).items,
    queryKey: QueryKeys.teams({ memberId: userId }),
  })

  return {
    isError: query.isError,
    loading: query.isPending && userId !== undefined,
    refetch: query.refetch,
    teams: query.data ?? EMPTY,
  }
}
