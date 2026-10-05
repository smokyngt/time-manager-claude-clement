import type { Clock } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { Errors } from '@/lib/errors'
import { useAuth } from '@/providers/use-auth'
import { useToastActions } from '@/providers/use-toast-actions'

type Context = { previous: Clock | null | undefined }

export function useClockIn() {
  const { t } = useTranslation('clocks')
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const toasts = useToastActions()

  const mutation = useMutation<{ clock: Clock }, Error, { note?: string }, Context>({
    meta: { successMessage: t('toast.clocked_in') },
    mutationFn: (params) => sdk.clocks.in(params),
    onError: (error, _params, context) => {
      queryClient.setQueryData(QueryKeys.currentClock(), context?.previous)
      if (!Errors.code.check(error, 'clock.conflict')) {
        toasts.showError(t('card.title'), Errors.translate(error))
      }
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: QueryKeys.currentClock() })
      const previous = queryClient.getQueryData<Clock | null>(QueryKeys.currentClock())
      const now = Date.now()
      const optimistic: Clock = {
        clockedInAt: now,
        clockedOutAt: null,
        createdAt: now,
        durationMs: null,
        id: 'optimistic',
        note: params.note ?? null,
        object: 'clock',
        source: 'clock',
        updatedAt: null,
        userId: user?.id ?? '',
      }
      queryClient.setQueryData<Clock | null>(QueryKeys.currentClock(), optimistic)
      return { previous }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QueryKeys.clocksAll() }),
        queryClient.invalidateQueries({ queryKey: QueryKeys.reportsAll() }),
      ])
    },
  })

  return {
    clockIn: mutation.mutate,
    conflict: Errors.code.check(mutation.error, 'clock.conflict'),
    pending: mutation.isPending,
    reset: mutation.reset,
  }
}
