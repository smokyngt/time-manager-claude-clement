import type { BulkFailure } from '@time-manager/sdk'

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { UserBulk } from '@/features/users/lib/user-bulk'
import { useToastActions } from '@/providers/use-toast-actions'

type Report = { count: number; failed: readonly BulkFailure[]; title: string; success: string }

export function useBulkFeedback() {
  const { t } = useTranslation('users')
  const { t: translateError } = useTranslation('errors')
  const toasts = useToastActions()

  const report = useCallback(
    ({ count, failed, success, title }: Report) => {
      if (failed.length > 0) {
        const reasons = UserBulk.reasons(failed, (code) =>
          translateError(code, { defaultValue: translateError('generic') }),
        )
        toasts.showError(title, t('toast.partial', { count: failed.length, reasons }))
      } else if (count > 0) {
        toasts.showSuccess(success)
      }
    },
    [t, toasts, translateError],
  )

  return useMemo(() => ({ report }), [report])
}
