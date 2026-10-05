import { skipToken, useQuery } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { Errors } from '@/lib/errors'

export function useUser(id: string | undefined) {
  const query = useQuery({
    queryFn: id === undefined ? skipToken : async () => (await sdk.users.retrieve(id)).user,
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
