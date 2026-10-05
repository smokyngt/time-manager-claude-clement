import { useQuery } from '@tanstack/react-query'

import { sdk } from '@/config/sdk'
import { QueryKeys } from '@/config/query-keys'
import { Errors } from '@/lib/errors'

export function useUser(id: string | undefined) {
  const query = useQuery({
    enabled: id !== undefined,
    queryFn: async () => (await sdk.users.retrieve(id!)).user,
    queryKey: QueryKeys.user(id ?? ''),
  })

  return {
    error: query.error,
    isError: query.isError,
    loaded: query.isSuccess,
    loading: query.isPending && id !== undefined,
    notFound: query.isError && Errors.code.check(query.error, 'user.not.found'),
    refetch: query.refetch,
    user: query.data,
  }
}
