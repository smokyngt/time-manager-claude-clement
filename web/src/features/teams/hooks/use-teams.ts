import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  archiveTeam,
  createTeam,
  deleteTeams,
  listTeams,
  restoreTeam,
  retrieveTeam,
  updateTeams,
} from '@/features/teams/api/teams'
import { teamKeys } from '@/features/teams/hooks/team-keys'
import { getErrorMessage } from '@/lib/api/errors'

import type { CreateTeamBody, UpdateTeamData } from '@/features/teams/api/types'

function useInvalidateTeams() {
  const query_client = useQueryClient()
  return () => query_client.invalidateQueries({ queryKey: teamKeys.all })
}

export function useArchiveTeam() {
  const invalidate = useInvalidateTeams()
  return useMutation({
    mutationFn: archiveTeam,
    onError: (error) => toast.error(getErrorMessage(error)),
    onSuccess: async (team) => {
      await invalidate()
      toast.success(`${team.name} was archived`)
    },
  })
}

export function useCreateTeam() {
  const invalidate = useInvalidateTeams()
  return useMutation({
    mutationFn: (body: CreateTeamBody) => createTeam(body),
    onSuccess: async (team) => {
      await invalidate()
      toast.success(`${team.name} was created`)
    },
  })
}

export function useDeleteTeam() {
  const invalidate = useInvalidateTeams()
  return useMutation({
    mutationFn: (id: string) => deleteTeams([id]),
    onError: (error) => toast.error(getErrorMessage(error)),
    onSuccess: async (result) => {
      await invalidate()
      if (result.failed > 0) toast.error('The team could not be deleted')
      else toast.success('Team deleted')
    },
  })
}

export function useRestoreTeam() {
  const invalidate = useInvalidateTeams()
  return useMutation({
    mutationFn: restoreTeam,
    onError: (error) => toast.error(getErrorMessage(error)),
    onSuccess: async (team) => {
      await invalidate()
      toast.success(`${team.name} was restored`)
    },
  })
}

export function useTeam(id: string) {
  return useQuery({ queryFn: () => retrieveTeam(id), queryKey: teamKeys.detail(id) })
}

export function useTeams(archived: boolean) {
  return useQuery({
    queryFn: () => listTeams({ archived }),
    queryKey: teamKeys.list(archived),
  })
}

export function useUpdateTeam(id: string) {
  const invalidate = useInvalidateTeams()
  return useMutation({
    mutationFn: (data: UpdateTeamData) => updateTeams([id], data),
    onSuccess: async (result) => {
      await invalidate()
      if (result.failed > 0) throw new Error('The team could not be updated')
      toast.success('Team updated')
    },
  })
}
