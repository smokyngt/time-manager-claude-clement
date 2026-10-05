import type { ReactNode } from 'react'

import { XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export type BulkActionBarProps = {
  children?: ReactNode
  count: number
  onClear: () => void
  onSelectAll?: () => void
}

export function BulkActionBar({ children, count, onClear, onSelectAll }: BulkActionBarProps) {
  const { t } = useTranslation('common')

  if (count === 0) {
    return null
  }

  return (
    <div
      aria-label={t('bulk.label')}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-xs"
      role="region"
    >
      <span className="text-sm font-medium">{t('bulk.selected', { count })}</span>
      {onSelectAll ? (
        <Button onClick={onSelectAll} size="sm" variant="ghost">
          {t('bulk.select_all')}
        </Button>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{children}</div>
      <Button aria-label={t('bulk.clear')} onClick={onClear} size="icon" variant="ghost">
        <XIcon />
      </Button>
    </div>
  )
}
