import type { Team } from '@time-manager/sdk'

import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { LIMITS } from '@/config/limits'

const EMPTY: Team[] = []

export function useTeamOptions(options: { enabled?: boolean } = {}) {
  const query = useQuery({
    enabled: options.enabled ?? true,
    queryFn: async () => (await sdk.teams.list({ archived: false, limit: LIMITS.pageSize.max })).items,
    queryKey: QueryKeys.teams({ archived: false, purpose: 'options' }),
  })

  return { loading: query.isPending && query.fetchStatus !== 'idle', teams: query.data ?? EMPTY }
}
