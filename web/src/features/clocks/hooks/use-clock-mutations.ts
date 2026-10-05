import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { UpdateClockData } from '@/features/clocks/api/types'

import { createClock, deleteClocks, updateClocks } from '@/features/clocks/api/clocks'
import {
  CLOCKS_QUERY_KEY,
  REPORTS_QUERY_KEY,
} from '@/features/clocks/hooks/query-keys'

function useInvalidateClocks() {
  const query_client = useQueryClient()
  return () =>
    Promise.all([
      query_client.invalidateQueries({ queryKey: CLOCKS_QUERY_KEY }),
      query_client.invalidateQueries({ queryKey: REPORTS_QUERY_KEY }),
    ])
}

export function useCreateClock() {
  const invalidate = useInvalidateClocks()
  return useMutation({ mutationFn: createClock, onSuccess: invalidate })
}

export function useDeleteClock() {
  const invalidate = useInvalidateClocks()
  return useMutation({
    mutationFn: (id: string) => deleteClocks([id]),
    onSuccess: invalidate,
  })
}

export function useUpdateClock() {
  const invalidate = useInvalidateClocks()
  return useMutation({
    mutationFn: ({ data, id }: { data: UpdateClockData; id: string }) => updateClocks([id], data),
    onSuccess: invalidate,
  })
}
