import type { CreateTeamResponse, TeamCreateParams } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { Errors } from '@/lib/errors'
import { useToastActions } from '@/providers/use-toast-actions'

export function useCreateTeam() {
  const { t } = useTranslation('teams')
  const queryClient = useQueryClient()
  const { showError } = useToastActions()

  const mutation = useMutation({
    meta: {
      successMessage: (data: CreateTeamResponse) => t('toast.created', { name: data.team.name }),
    },
    mutationFn: (params: TeamCreateParams) => sdk.teams.create(params),
    onError: (error) => {
      showError(t('create.title'), Errors.translate(error))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QueryKeys.teams() })
    },
  })

  return { createTeam: mutation.mutate, creating: mutation.isPending, mutation }
}
