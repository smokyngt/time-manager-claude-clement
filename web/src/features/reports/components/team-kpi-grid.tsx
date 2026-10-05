import {
  AlarmClockIcon,
  ClockIcon,
  PercentIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react'

import type { TeamKpis } from '@/features/reports/api/types'

import { KPI_GRID_CLASS } from '@/features/reports/components/kpi-grid'
import { KpiCard } from '@/features/reports/components/kpi-card'
import {
  formatDuration,
  formatPercent,
  formatSignedDuration,
} from '@/features/reports/lib/format'

export function TeamKpiGrid({ kpis }: { kpis: TeamKpis }) {
  const overtime_tone = kpis.overtime_ms < 0 ? 'negative' : kpis.overtime_ms > 0 ? 'positive' : undefined
  return (
    <div className={KPI_GRID_CLASS}>
      <KpiCard
        hint={`${kpis.active_members} of ${kpis.member_count} members active`}
        icon={UsersIcon}
        label="Members"
        value={String(kpis.member_count)}
      />
      <KpiCard
        hint="all members"
        icon={ClockIcon}
        label="Worked hours"
        value={formatDuration(kpis.worked_ms)}
      />
      <KpiCard
        hint="per member and day"
        icon={TimerIcon}
        label="Average per day"
        value={formatDuration(kpis.average_daily_ms)}
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
