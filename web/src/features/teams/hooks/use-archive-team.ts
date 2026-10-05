import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useArchiveTeam() {
  const { t } = useTranslation('teams')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    meta: {
      successMessage: (_data: unknown, ids: string[]) => t('toast.archived', { count: ids.length }),
    },
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => sdk.teams.archive(id)))
      return ids
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QueryKeys.teamsAll() })
    },
  })

  return { archiveTeams: mutation.mutate, archiving: mutation.isPending, mutation }
}
