import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { TeamRole } from '@/features/teams/api/types'

import { addTeamMembers, listTeamMembers, removeTeamMembers } from '@/features/teams/api/teams'
import { listUserOptions } from '@/features/teams/api/users'
import { teamKeys } from '@/features/teams/hooks/team-keys'
import { getErrorMessage } from '@/lib/api/errors'

function useInvalidateTeams() {
  const query_client = useQueryClient()
  return () => query_client.invalidateQueries({ queryKey: teamKeys.all })
}

export function useAddTeamMembers(team_id: string) {
  const invalidate = useInvalidateTeams()
  return useMutation({
    mutationFn: (user_ids: string[]) => addTeamMembers(team_id, user_ids),
    onError: (error) => toast.error(getErrorMessage(error)),
    onSuccess: async (result) => {
      await invalidate()
      if (result.ok > 0) toast.success(`${result.ok} member(s) added`)
      if (result.failed > 0) toast.error(`${result.failed} member(s) could not be added`)
    },
  })
}

export function useRemoveTeamMember(team_id: string) {
  const invalidate = useInvalidateTeams()
  return useMutation({
    mutationFn: (user_id: string) => removeTeamMembers(team_id, [user_id]),
    onError: (error) => toast.error(getErrorMessage(error)),
    onSuccess: async (result) => {
      await invalidate()
      if (result.failed > 0) toast.error('The member could not be removed')
      else toast.success('Member removed')
    },
  })
}

export function useTeamMembers(team_id: string) {
  return useQuery({
    queryFn: () => listTeamMembers(team_id),
    queryKey: teamKeys.members(team_id),
  })
}

export function useUserOptions(roles: TeamRole[], enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => listUserOptions(roles),
    queryKey: teamKeys.userOptions(roles),
  })
}
