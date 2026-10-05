import type { Clock } from '@time-manager/sdk'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { ClockEntry } from '@/features/clocks/lib/clock-values'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'
import { useUndo } from '@/hooks/use-undo'
import { Errors } from '@/lib/errors'
import { useToastActions } from '@/providers/use-toast-actions'

function params(entry: ClockEntry) {
  return entry.note === '' ? { ...entry, note: undefined } : entry
}

export function useCreateClock() {
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

  const mutation = useMutation<{ clock: Clock }, Error, ClockEntry>({
    meta: { successMessage: t('toast.created') },
    mutationFn: (entry) => sdk.clocks.create(params(entry)),
    onError: (error) => {
      toasts.showError(t('create.title'), Errors.translate(error))
    },
    onSuccess: async ({ clock }, entry) => {
      let currentId = clock.id
      undo.push({
        label: t('toast.undo_create'),
        redo: async () => {
          const result = await sdk.clocks.create(params(entry))
          currentId = result.clock.id
          await invalidate()
        },
        undo: async () => {
          await sdk.clocks.delete([currentId])
          await invalidate()
        },
      })
      await invalidate()
    },
  })

  return { create: mutation.mutate, pending: mutation.isPending }
}
