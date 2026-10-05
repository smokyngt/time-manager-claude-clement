import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useTeam(teamId: string) {
  const query = useQuery({
    enabled: teamId !== '',
    meta: { suppressError: true },
    queryFn: async () => (await sdk.teams.retrieve(teamId)).team,
    queryKey: QueryKeys.team(teamId),
  })

  return {
    error: query.error,
    isError: query.isError,
    loaded: query.isSuccess,
    loading: query.isPending,
    refetch: query.refetch,
    team: query.data,
  }
}
