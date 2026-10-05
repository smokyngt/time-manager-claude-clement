import type { Clock } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { Errors } from '@/lib/errors'
import { useToastActions } from '@/providers/use-toast-actions'

type Context = { previous: Clock | null | undefined }

export function useClockOut() {
  const { t } = useTranslation('clocks')
  const queryClient = useQueryClient()
  const toasts = useToastActions()

  const mutation = useMutation<{ clock: Clock }, Error, { note?: string }, Context>({
    meta: { successMessage: t('toast.clocked_out') },
    mutationFn: (params) => sdk.clocks.out(params),
    onError: (error, _params, context) => {
      queryClient.setQueryData(QueryKeys.currentClock(), context?.previous)
      if (!Errors.code.check(error, 'clock.conflict')) {
        toasts.showError(t('card.title'), Errors.translate(error))
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: QueryKeys.currentClock() })
      const previous = queryClient.getQueryData<Clock | null>(QueryKeys.currentClock())
      queryClient.setQueryData<Clock | null>(QueryKeys.currentClock(), null)
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
    clockOut: mutation.mutate,
    conflict: Errors.code.check(mutation.error, 'clock.conflict'),
    pending: mutation.isPending,
    reset: mutation.reset,
  }
}
