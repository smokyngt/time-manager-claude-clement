import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { useBulkFeedback } from '@/features/users/hooks/use-bulk-feedback'
import { UsersCache } from '@/features/users/lib/users-cache'

export type DeleteUsersOptions = {
  onDeleted?: (ids: string[]) => void
}

export function useDeleteUsers({ onDeleted }: DeleteUsersOptions = {}) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('users')
  const { report } = useBulkFeedback()

  return useMutation({
    mutationFn: (ids: string[]) => sdk.users.delete(ids),
    onSettled: async () => {
      await UsersCache.invalidate(queryClient)
    },
    onSuccess: async (result) => {
      await queryClient.cancelQueries({ queryKey: QueryKeys.usersAll() })
      result.deleted.forEach((id) => {
        queryClient.removeQueries({ queryKey: QueryKeys.user(id) })
      })
      onDeleted?.(result.deleted)
      report({
        count: 0,
        failed: result.failed,
        success: '',
        title: t('delete.title', { count: result.failed.length }),
      })
    },
  })
}
