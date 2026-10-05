import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { UserUpdateData } from '@/features/users/types'

import { updateUsers } from '@/features/users/api/users'
import { USERS_QUERY_KEY } from '@/features/users/hooks/use-users'

export function useUpdateProfile(id: string) {
  const query_client = useQueryClient()
  return useMutation({
    mutationFn: async (data: UserUpdateData) => {
      const result = await updateUsers([id], data)
      const failure = result.failed[0]
      if (failure) throw new Error(`Could not update your profile (${failure.code})`)
      return result
    },
    onSuccess: () => query_client.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  })
}
