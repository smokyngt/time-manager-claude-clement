import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createUser, listUsers } from '@/features/users/api/users'

export const USERS_QUERY_KEY = ['users', 'list'] as const

export function useCreateUser() {
  const query_client = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => query_client.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  })
}

export function useUsers() {
  return useQuery({ queryFn: listUsers, queryKey: USERS_QUERY_KEY })
}
