import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { updateSelf } from '@/features/profile/hooks/use-update-profile'
import { Errors } from '@/lib/errors'

export type PasswordChange = { currentPassword: string; password: string }

export function useChangePassword(id: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('profile')
  const mutation = useMutation({
    meta: { successMessage: t('toast.password_changed'), suppressError: true },
    mutationFn: (data: PasswordChange) => updateSelf(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QueryKeys.me() }),
  })
  return {
    change: mutation.mutateAsync,
    error: mutation.error,
    pending: mutation.isPending,
    reset: mutation.reset,
    wrongPassword: Errors.code.check(mutation.error, 'user.password.invalid'),
  }
}
