import type { QueryClient } from '@tanstack/react-query'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Clock } from '@/features/clocks/api/types'

import { clockIn, clockOut } from '@/features/clocks/api/clocks'
import {
  CLOCKS_QUERY_KEY,
  CURRENT_CLOCK_QUERY_KEY,
  REPORTS_QUERY_KEY,
} from '@/features/clocks/hooks/query-keys'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

interface ActionConfig {
  conflict_message: string
  mutationFn: (note?: string) => Promise<Clock>
  optimistic: (note: string | undefined) => Clock | null
  success_message: string
}

const IN_CONFIG: ActionConfig = {
  conflict_message: 'You are already clocked in',
  mutationFn: clockIn,
  optimistic: (note) => ({
    clocked_in_at: Date.now(),
    clocked_out_at: null,
    created_at: Date.now(),
    duration_ms: null,
    id: 'optimistic',
    note: note ?? null,
    object: 'clock',
    source: 'clock',
    updated_at: null,
    user_id: '',
  }),
  success_message: 'Clocked in',
}

const OUT_CONFIG: ActionConfig = {
  conflict_message: 'You are not clocked in',
  mutationFn: clockOut,
  optimistic: () => null,
  success_message: 'Clocked out',
}

export function getClockErrorMessage(error: unknown, conflict_message: string) {
  if (error instanceof ApiError && error.status === 409) return conflict_message
  return getErrorMessage(error)
}

function invalidateClocks(query_client: QueryClient) {
  return Promise.all([
    query_client.invalidateQueries({ queryKey: CLOCKS_QUERY_KEY }),
    query_client.invalidateQueries({ queryKey: REPORTS_QUERY_KEY }),
  ])
}

function useClockAction(config: ActionConfig) {
  const query_client = useQueryClient()
  return useMutation({
    mutationFn: config.mutationFn,
    onError: (error, _note, context) => {
      query_client.setQueryData(CURRENT_CLOCK_QUERY_KEY, context?.previous ?? null)
      toast.error(getClockErrorMessage(error, config.conflict_message))
    },
    onMutate: async (note): Promise<{ previous: Clock | null | undefined }> => {
      await query_client.cancelQueries({ queryKey: CURRENT_CLOCK_QUERY_KEY })
      const previous = query_client.getQueryData<Clock | null>(CURRENT_CLOCK_QUERY_KEY)
      query_client.setQueryData(CURRENT_CLOCK_QUERY_KEY, config.optimistic(note))
      return { previous }
    },
    onSettled: () => invalidateClocks(query_client),
    onSuccess: () => {
      toast.success(config.success_message)
    },
  })
}

export function useClockIn() {
  return useClockAction(IN_CONFIG)
}

export function useClockOut() {
  return useClockAction(OUT_CONFIG)
}
