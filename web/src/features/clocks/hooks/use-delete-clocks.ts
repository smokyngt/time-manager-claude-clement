import type { BulkDeleteResponse } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useDeleteClocks() {
  const queryClient = useQueryClient()

  const mutation = useMutation<BulkDeleteResponse, Error, string[]>({
    mutationFn: (ids) => sdk.clocks.delete(ids),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QueryKeys.clocksAll() }),
        queryClient.invalidateQueries({ queryKey: QueryKeys.reportsAll() }),
      ])
    },
  })

  return { deleteClocks: mutation.mutate, pending: mutation.isPending }
}
