import type { BulkUpdateResponse, TeamUpdateData } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { TeamBulk } from '@/features/teams/lib/team-bulk'
import { Errors } from '@/lib/errors'
import { useToastActions } from '@/providers/use-toast-actions'

export type UpdateTeamVariables = { data: TeamUpdateData; ids: string[] }

export function useUpdateTeam() {
  const { t } = useTranslation('teams')
  const queryClient = useQueryClient()
  const { showError } = useToastActions()

  const mutation = useMutation({
    meta: {
      successMessage: (data: BulkUpdateResponse) =>
        t('toast.updated', { count: data.updated.length }),
    },
    mutationFn: async ({ data, ids }: UpdateTeamVariables) => {
      const result = await sdk.teams.update(ids, data)
      TeamBulk.assertSome(result.updated.length, result.failed)
      return result
    },
    onError: (error) => {
      showError(t('edit.title'), Errors.translate(error))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QueryKeys.teamsAll() })
    },
  })

  return { mutation, updateTeam: mutation.mutate, updating: mutation.isPending }
}
