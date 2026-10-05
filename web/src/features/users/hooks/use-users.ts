import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { UserFilters, UserUpdateData } from '@/features/users/types'

import {
  archiveUsers,
  createUser,
  deleteUsers,
  getUser,
  listUsers,
  restoreUsers,
  updateUsers,
} from '@/features/users/api/users'

export const USERS_QUERY_KEY = ['users'] as const

export function useArchiveUsers() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: archiveUsers, onSettled: invalidate })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: createUser, onSuccess: invalidate })
}

export function useDeleteUsers() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: deleteUsers, onSettled: invalidate })
}

export function useRestoreUsers() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: restoreUsers, onSettled: invalidate })
}

export function useUpdateUsers() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ data, ids }: { data: UserUpdateData; ids: string[] }) => updateUsers(ids, data),
    onSettled: invalidate,
  })
}

export function useUser(id: string | undefined) {
  return useQuery({
    enabled: id !== undefined,
    queryFn: () => getUser(id ?? ''),
    queryKey: [...USERS_QUERY_KEY, 'detail', id],
  })
}

export function useUsers(filters: UserFilters) {
  return useInfiniteQuery({
    getNextPageParam: (page) => (page.more ? (page.next ?? undefined) : undefined),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listUsers(filters, pageParam),
    queryKey: [...USERS_QUERY_KEY, 'list', filters],
  })
}

function useInvalidateUsers() {
  const query_client = useQueryClient()
  return () => query_client.invalidateQueries({ queryKey: USERS_QUERY_KEY })
}
