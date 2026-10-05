import type { TeamMembersAddResponse } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { TeamBulk } from '@/features/teams/lib/team-bulk'
import { Errors } from '@/lib/errors'
import { useToastActions } from '@/providers/use-toast-actions'

export function useAddMembers(teamId: string) {
  const { t } = useTranslation('teams')
  const queryClient = useQueryClient()
  const { showError } = useToastActions()

  const mutation = useMutation({
    meta: {
      successMessage: (data: TeamMembersAddResponse) =>
        t('toast.members_added', { count: data.added.length }),
    },
    mutationFn: async (userIds: string[]) => {
      const result = await sdk.teamMembers.add(teamId, userIds)
      TeamBulk.assertSome(result.added.length, result.failed)
      return result
    },
    onError: (error) => {
      showError(t('members.add.title'), Errors.translate(error))
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QueryKeys.team(teamId) }),
        queryClient.invalidateQueries({ queryKey: QueryKeys.teams() }),
      ])
      if (result.failed.length > 0) {
        showError(t('members.add.title'), t('toast.partial', { count: result.failed.length }))
      }
    },
  })

  return { addMembers: mutation.mutate, adding: mutation.isPending, mutation }
}
