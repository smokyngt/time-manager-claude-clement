import { AlertCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Errors } from '@/lib/errors'

export type ErrorStateProps = {
  description?: string
  error?: unknown
  onRetry?: () => void
  title?: string
}

export function ErrorState({ description, error, onRetry, title }: ErrorStateProps) {
  const { t } = useTranslation('common')
  const text =
    description ?? (error === undefined ? t('error.description') : Errors.translate(error))

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center"
      role="alert"
    >
      <AlertCircleIcon aria-hidden className="size-8 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium">{title ?? t('error.title')}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" variant="outline">
          {t('error.retry')}
        </Button>
      ) : null}
    </div>
  )
}
