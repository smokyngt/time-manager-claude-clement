import type { TeamReportKpis } from '@time-manager/sdk'

import {
  AlarmClockIcon,
  ClockIcon,
  PercentIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { KpiCard } from '@/features/reports/components/kpi-card'
import { KPI_GRID_CLASS } from '@/features/reports/components/kpi-grid'
import { formatPercent, overtimeTone, signedDuration } from '@/features/reports/lib/kpi'
import { Duration } from '@/lib/duration'

export type TeamKpiGridProps = {
  complete: boolean
  kpis: TeamReportKpis
}

export function TeamKpiGrid({ complete, kpis }: TeamKpiGridProps) {
  const { i18n, t } = useTranslation('reports')
  const locale = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className={KPI_GRID_CLASS}>
      <KpiCard
        hint={t('kpi.members.hint', { active: kpis.activeMembers, total: kpis.memberCount })}
        icon={UsersIcon}
        label={t('kpi.members.label')}
        value={String(kpis.memberCount)}
      />
      <KpiCard
        hint={t('kpi.worked_team.hint')}
        icon={ClockIcon}
        label={t('kpi.worked_team.label')}
        value={Duration.short(kpis.workedMs)}
      />
      <KpiCard
        hint={t('kpi.average_team.hint')}
        icon={TimerIcon}
        label={t('kpi.average_team.label')}
        value={Duration.short(kpis.averageDailyMs)}
      />
      <KpiCard
        hint={kpis.overtimeMs < 0 ? t('kpi.overtime.under') : t('kpi.overtime.over')}
        icon={kpis.overtimeMs < 0 ? TrendingDownIcon : TrendingUpIcon}
        label={t('kpi.overtime.label')}
        tone={overtimeTone(kpis.overtimeMs, complete)}
        value={signedDuration(kpis.overtimeMs)}
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
