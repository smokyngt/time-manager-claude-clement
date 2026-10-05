import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useRestoreTeam() {
  const { t } = useTranslation('teams')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    meta: { successMessage: (_data: unknown, ids: string[]) => t('toast.restored', { count: ids.length }) },
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => sdk.teams.restore(id)))
      return ids
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QueryKeys.teamsAll() })
    },
  })

  return { mutation, restoreTeams: mutation.mutate, restoring: mutation.isPending }
}
