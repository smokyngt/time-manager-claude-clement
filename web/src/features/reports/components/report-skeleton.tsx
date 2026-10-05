import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { KPI_GRID_CLASS } from '@/features/reports/components/kpi-grid'

export function ReportSkeleton() {
  const { t } = useTranslation('common')

  return (
    <div aria-busy="true" className="space-y-4" role="status">
      <div className={KPI_GRID_CLASS}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-28" key={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <span className="sr-only">{t('state.loading')}</span>
    </div>
  )
}
