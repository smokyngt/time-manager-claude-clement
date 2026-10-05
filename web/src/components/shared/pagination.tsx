import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export type PaginationProps = {
  hasNext: boolean
  hasPrevious: boolean
  onNext: () => void
  onPrevious: () => void
  page: number
  pages?: number
  total?: number
}

export function Pagination({
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  page,
  pages,
  total,
}: PaginationProps) {
  const { t } = useTranslation('common')

  if (!hasNext && !hasPrevious) {
    return null
  }

  return (
    <nav
      aria-label={t('pagination.label')}
      className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <span>{total === undefined ? null : t('pagination.summary', { count: total })}</span>
      <div className="flex items-center gap-2">
        <Button
          aria-label={t('pagination.previous')}
          disabled={!hasPrevious}
          onClick={onPrevious}
          size="icon"
          variant="outline"
        >
          <ChevronLeftIcon />
        </Button>
        <span aria-current="page">
          {pages === undefined ? String(page) : t('pagination.page', { page, pages })}
        </span>
        <Button
          aria-label={t('pagination.next')}
          disabled={!hasNext}
          onClick={onNext}
          size="icon"
          variant="outline"
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  )
}
