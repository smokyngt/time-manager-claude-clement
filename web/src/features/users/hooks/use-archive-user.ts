import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { sdk } from '@/config/sdk'
import { useBulkFeedback } from '@/features/users/hooks/use-bulk-feedback'
import { UserBulk } from '@/features/users/lib/user-bulk'
import { UsersCache } from '@/features/users/lib/users-cache'
import { useUndoStore } from '@/stores/undo'

export function useArchiveUser() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('users')
  const { report } = useBulkFeedback()

  return useMutation({
    mutationFn: (ids: string[]) => UserBulk.run(ids, (id) => sdk.users.archive(id)),
    onSuccess: async (result) => {
      report({
        count: result.updated.length,
        failed: result.failed,
        success: t('toast.archived', { count: result.updated.length }),
        title: t('archive.title', { count: result.updated.length || result.failed.length }),
      })
      const updated = result.updated
      if (updated.length > 0) {
        useUndoStore.getState().push({
          label: t('undo.archived', { count: updated.length }),
          redo: async () => {
            await UserBulk.run(updated, (id) => sdk.users.archive(id))
            await UsersCache.invalidate(queryClient)
          },
          undo: async () => {
            await UserBulk.run(updated, (id) => sdk.users.restore(id))
            await UsersCache.invalidate(queryClient)
          },
        })
      }
      await UsersCache.invalidate(queryClient)
    },
  })
}
