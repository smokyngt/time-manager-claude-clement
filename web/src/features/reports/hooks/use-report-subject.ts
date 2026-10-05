import { useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useReportUser(userId: string) {
  const query = useQuery({
    meta: { suppressError: true },
    queryFn: async () => (await sdk.users.retrieve(userId)).user,
    queryKey: [...QueryKeys.user(userId), 'report-subject'],
  })
  return { user: query.data }
}

export function useReportTeam(teamId: string) {
  const query = useQuery({
    meta: { suppressError: true },
    queryFn: async () => (await sdk.teams.retrieve(teamId)).team,
    queryKey: [...QueryKeys.team(teamId), 'report-subject'],
  })
  return { team: query.data }
}
