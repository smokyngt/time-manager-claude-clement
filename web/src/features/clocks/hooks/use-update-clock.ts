import type { BulkUpdateResponse, Clock } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { ClockEntry } from '@/features/clocks/lib/clock-values'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { useUndo } from '@/hooks/use-undo'
import { Errors } from '@/lib/errors'
import { useToastActions } from '@/providers/use-toast-actions'

type Variables = { clock: Clock; entry: ClockEntry }

export function useUpdateClock() {
  const { t } = useTranslation('clocks')
  const queryClient = useQueryClient()
  const toasts = useToastActions()
  const undo = useUndo()

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QueryKeys.clocksAll() }),
      queryClient.invalidateQueries({ queryKey: QueryKeys.reportsAll() }),
    ])
  }

  const mutation = useMutation<BulkUpdateResponse, Error, Variables>({
    meta: { successMessage: (result: BulkUpdateResponse) => (result.success ? t('toast.updated') : t('toast.update_failed')) },
    mutationFn: ({ clock, entry }) =>
      sdk.clocks.update([clock.id], {
        clockedInAt: entry.clockedInAt,
        clockedOutAt: entry.clockedOutAt,
        note: entry.note,
      }),
    onError: (error) => {
      toasts.showError(t('edit.title'), Errors.translate(error))
    },
    onSuccess: async (result, { clock, entry }) => {
      if (result.success) {
        undo.push({
          label: t('toast.undo_update'),
          redo: async () => {
            await sdk.clocks.update([clock.id], {
              clockedInAt: entry.clockedInAt,
              clockedOutAt: entry.clockedOutAt,
              note: entry.note,
            })
            await invalidate()
          },
          undo: async () => {
            await sdk.clocks.update([clock.id], {
              clockedInAt: clock.clockedInAt,
              clockedOutAt: clock.clockedOutAt ?? entry.clockedOutAt,
              note: clock.note ?? '',
            })
            await invalidate()
          },
        })
      }
      await invalidate()
    },
  })

  return { pending: mutation.isPending, update: mutation.mutate }
}
