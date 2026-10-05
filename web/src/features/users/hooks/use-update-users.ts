import type { UserUpdateData } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { useBulkFeedback } from '@/features/users/hooks/use-bulk-feedback'
import { UsersCache } from '@/features/users/lib/users-cache'
import { Errors } from '@/lib/errors'
import { useToastActions } from '@/providers/use-toast-actions'
import { useUndoStore } from '@/stores/undo'

export type UpdateUsersVariables = {
  data: UserUpdateData
  ids: string[]
  revert?: UserUpdateData
}

export function useUpdateUsers() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('users')
  const { showError } = useToastActions()
  const { report } = useBulkFeedback()

  return useMutation({
    mutationFn: ({ data, ids }: UpdateUsersVariables) => sdk.users.update(ids, data),
    onError: (error) => {
      showError(t('edit.title'), Errors.translate(error))
    },
    onSuccess: async (result, { data, ids, revert }) => {
      report({
        count: result.updated.length,
        failed: result.failed,
        success: t('toast.updated', { count: result.updated.length }),
        title: t('edit.title'),
      })
      if (revert !== undefined && result.updated.length > 0) {
        const updated = result.updated
        useUndoStore.getState().push({
          label: t('undo.updated', { count: updated.length }),
          redo: async () => {
            await sdk.users.update(updated, data)
            await UsersCache.invalidate(queryClient)
          },
          undo: async () => {
            await sdk.users.update(updated, revert)
            await UsersCache.invalidate(queryClient)
          },
        })
      }
      await Promise.all([
        UsersCache.invalidate(queryClient),
        queryClient.invalidateQueries({ queryKey: QueryKeys.me() }),
      ])
      return ids
    },
  })
}
