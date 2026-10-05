import type { BulkDeleteResponse } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { TeamBulk } from '@/features/teams/lib/team-bulk'
import { useToastActions } from '@/providers/use-toast-actions'

export type DeleteTeamOptions = { navigateTo?: string }

export function useDeleteTeam(options: DeleteTeamOptions = {}) {
  const { t } = useTranslation('teams')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showError } = useToastActions()

  const mutation = useMutation({
    meta: {
      successMessage: (data: BulkDeleteResponse) =>
        t('toast.deleted', { count: data.deleted.length }),
    },
    mutationFn: async (ids: string[]) => {
      const result = await sdk.teams.delete(ids)
      TeamBulk.assertSome(result.deleted.length, result.failed)
      return result
    },
    onSuccess: async (result, ids) => {
      await Promise.all(
        ids.map((id) => queryClient.cancelQueries({ queryKey: QueryKeys.team(id) })),
      )
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: QueryKeys.team(id) })
      })
      if (options.navigateTo !== undefined) {
        await navigate(options.navigateTo)
      }
      await queryClient.invalidateQueries({ queryKey: QueryKeys.teams() })
      if (result.failed.length > 0) {
        showError(t('delete.title'), t('toast.partial', { count: result.failed.length }))
      }
    },
  })

  return {
    deleteTeams: mutation.mutate,
    deleteTeamsAsync: mutation.mutateAsync,
    deleting: mutation.isPending,
    mutation,
  }
}
