import type { UserUpdateData } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TimeManagerError } from '@time-manager/sdk'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { useAuthStore } from '@/stores/auth'

export type ProfileUpdate = UserUpdateData

export async function updateSelf(id: string, data: ProfileUpdate) {
  const result = await sdk.users.update([id], data)
  const failure = result.failed[0]
  if (failure) {
    throw new TimeManagerError({ code: failure.code, status: 400 })
  }
  const me = await sdk.auth.me()
  useAuthStore.getState().setUser(me.user)
  return me.user
}

export function useUpdateProfile(id: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('profile')
  const mutation = useMutation({
    meta: { successMessage: t('toast.updated') },
    mutationFn: (data: ProfileUpdate) => updateSelf(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QueryKeys.me() }),
  })
  return { pending: mutation.isPending, update: mutation.mutateAsync }
}
