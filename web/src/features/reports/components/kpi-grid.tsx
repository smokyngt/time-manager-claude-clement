import {
  AlarmClockIcon,
  CalendarCheckIcon,
  ClockIcon,
  PercentIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from 'lucide-react'

import type { UserKpis } from '@/features/reports/api/types'

import { KpiCard } from '@/features/reports/components/kpi-card'
import {
  formatDuration,
  formatPercent,
  formatSignedDuration,
} from '@/features/reports/lib/format'

export const KPI_GRID_CLASS = 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6'

export function KpiGrid({ kpis }: { kpis: UserKpis }) {
  const overtime_tone = kpis.overtime_ms < 0 ? 'negative' : kpis.overtime_ms > 0 ? 'positive' : undefined
  return (
    <div className={KPI_GRID_CLASS}>
      <KpiCard
        hint={`of ${formatDuration(kpis.target_ms)} target`}
        icon={ClockIcon}
        label="Worked hours"
        value={formatDuration(kpis.worked_ms)}
      />
      <KpiCard
        hint="on worked days"
        icon={TimerIcon}
        label="Average per day"
        value={formatDuration(kpis.average_daily_ms)}
      />
      <KpiCard
        hint="with at least one clock"
        icon={CalendarCheckIcon}
        label="Days worked"
        value={String(kpis.days_worked)}
      />
      <KpiCard
        hint={kpis.overtime_ms < 0 ? 'under target' : 'over target'}
        icon={kpis.overtime_ms < 0 ? TrendingDownIcon : TrendingUpIcon}
        label="Overtime"
        tone={overtime_tone}
        value={formatSignedDuration(kpis.overtime_ms)}
      />
      <KpiCard
        hint="of days worked"
        icon={PercentIcon}
        label="Lateness rate"
        value={formatPercent(kpis.lateness_rate)}
      />
      <KpiCard
        hint="more than 5 min late"
        icon={AlarmClockIcon}
        label="Late days"
        value={String(kpis.late_days)}
      />
    </div>
  )
}
