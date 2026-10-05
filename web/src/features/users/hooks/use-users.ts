import type { Role, User } from '@time-manager/sdk'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export type UsersFilters = {
  archived?: boolean
  cursor?: string
  limit?: number
  role?: Role
  teamId?: string
}

const EMPTY: User[] = []

export function useUsers(filters: UsersFilters = {}, options: { enabled?: boolean } = {}) {
  const query = useQuery({
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    queryFn: () => sdk.users.list(filters),
    queryKey: QueryKeys.users({ ...filters }),
  })

  return {
    error: query.error,
    fetching: query.isFetching,
    isError: query.isError,
    loaded: query.isSuccess,
    loading: query.isPending,
    more: query.data?.more ?? false,
    next: query.data?.next ?? null,
    refetch: query.refetch,
    total: query.data?.total ?? 0,
    users: query.data?.items ?? EMPTY,
  }
}
