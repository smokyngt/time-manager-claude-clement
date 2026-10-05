import type { UserCreateParams } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { sdk } from '@/config/sdk'
import { UserSearch } from '@/features/users/lib/user-search'
import { UsersCache } from '@/features/users/lib/users-cache'
import { Errors } from '@/lib/errors'
import { useToastActions } from '@/providers/use-toast-actions'
import { useUndoStore } from '@/stores/undo'

export function useCreateUser() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('users')
  const { showError } = useToastActions()

  return useMutation({
    meta: {
      successMessage: (data: { user: Parameters<typeof UserSearch.name>[0] }) =>
        t('toast.created', { name: UserSearch.name(data.user) }),
    },
    mutationFn: (params: UserCreateParams) => sdk.users.create(params),
    onError: (error) => {
      showError(t('create.title'), Errors.translate(error))
    },
    onSuccess: async ({ user }) => {
      useUndoStore.getState().push({
        label: t('undo.created', { name: UserSearch.name(user) }),
        redo: async () => {
          await sdk.users.restore(user.id)
          await UsersCache.invalidate(queryClient)
        },
        undo: async () => {
          await sdk.users.archive(user.id)
          await UsersCache.invalidate(queryClient)
        },
      })
      await UsersCache.invalidate(queryClient)
    },
  })
}
