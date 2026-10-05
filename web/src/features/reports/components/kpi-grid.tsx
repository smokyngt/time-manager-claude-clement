import type { UserReportKpis } from '@time-manager/sdk'

import {
  AlarmClockIcon,
  CalendarCheckIcon,
  ClockIcon,
  PercentIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { KpiCard } from '@/features/reports/components/kpi-card'
import { formatPercent, overtimeTone, signedDuration, userOvertime } from '@/features/reports/lib/kpi'
import { Duration } from '@/lib/duration'

export const KPI_GRID_CLASS = 'grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4'

export type KpiGridProps = {
  kpis: UserReportKpis
  now: number
  range: { from: number; to: number }
}

export function KpiGrid({ kpis, now, range }: KpiGridProps) {
  const { i18n, t } = useTranslation('reports')
  const complete = range.to <= now
  const overtime = userOvertime(kpis, { ...range, now })
  const locale = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className={KPI_GRID_CLASS}>
      <KpiCard
        hint={t('kpi.worked.hint', { target: Duration.short(kpis.targetMs) })}
        icon={ClockIcon}
        label={t('kpi.worked.label')}
        value={Duration.short(kpis.workedMs)}
      />
      <KpiCard
        hint={t('kpi.average.hint')}
        icon={TimerIcon}
        label={t('kpi.average.label')}
        value={Duration.short(kpis.averageDailyMs)}
      />
      <KpiCard
        hint={t('kpi.days.hint')}
        icon={CalendarCheckIcon}
        label={t('kpi.days.label')}
        value={String(kpis.daysWorked)}
      />
      <KpiCard
        hint={overtime < 0 ? t('kpi.overtime.under') : t('kpi.overtime.over')}
        icon={overtime < 0 ? TrendingDownIcon : TrendingUpIcon}
        label={t('kpi.overtime.label')}
        tone={overtimeTone(overtime, complete)}
        value={signedDuration(overtime)}
      />
      <KpiCard
        hint={t('kpi.lateness.hint')}
        icon={PercentIcon}
        label={t('kpi.lateness.label')}
        value={formatPercent(kpis.latenessRate, locale)}
      />
      <KpiCard
        hint={t('kpi.late_days.hint')}
        icon={AlarmClockIcon}
        label={t('kpi.late_days.label')}
        value={String(kpis.lateDays)}
      />
    </div>
  )
}
