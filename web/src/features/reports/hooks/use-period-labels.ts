import type { Granularity } from '@time-manager/sdk'

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Dates } from '@/lib/dates'

export function usePeriodLabels() {
  const { t } = useTranslation('reports')

  const axis = useCallback((periodStart: number) => Dates.date(periodStart), [])
  const full = useCallback(
    (periodStart: number, granularity: Granularity) =>
      granularity === 'week'
        ? t('chart.week_of', { date: Dates.date(periodStart) })
        : Dates.date(periodStart),
    [t],
  )
  const unit = useCallback((granularity: Granularity) => t(`unit.${granularity}`), [t])

  return { axis, full, unit }
}
