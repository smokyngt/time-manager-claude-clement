import type { Order, Team } from '@time-manager/sdk'

import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { Pages } from '@/features/teams/lib/pages'

export type TeamsFilters = { archived: boolean; order: Order }

const NO_TEAMS: Team[] = []

export function useTeams(filters: TeamsFilters) {
  const query = useQuery({
    meta: { suppressError: true },
    queryFn: () =>
      Pages.all((page) =>
        sdk.teams.list({ archived: filters.archived, order: filters.order, ...page }),
      ),
    queryKey: QueryKeys.teams(filters),
  })

  return {
    error: query.error,
    isError: query.isError,
    loaded: query.isSuccess,
    loading: query.isPending,
    refetch: query.refetch,
    teams: query.data?.items ?? NO_TEAMS,
    total: query.data?.total ?? 0,
  }
}
