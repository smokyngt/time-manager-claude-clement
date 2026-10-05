import { UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Empty, ErrorState } from '@/components/shared'
import { PeriodPicker } from '@/features/reports/components/period-picker'
import { ReportSkeleton } from '@/features/reports/components/report-skeleton'
import { TeamKpiGrid } from '@/features/reports/components/team-kpi-grid'
import { TeamMembersTable } from '@/features/reports/components/team-members-table'
import { WorkedHoursChart } from '@/features/reports/components/worked-hours-chart'
import { usePeriod } from '@/features/reports/hooks/use-period'
import { useTeamReport } from '@/features/reports/hooks/use-team-report'

export type TeamReportViewProps = {
  teamId: string
}

export function TeamReportView({ teamId }: TeamReportViewProps) {
  const { t } = useTranslation('reports')
  const { auto, change, now, period, state } = usePeriod()
  const { error, isError, loading, refetch, report } = useTeamReport(
    { from: period.from, granularity: period.granularity, teamId, to: period.to },
    !period.error,
  )

  return (
    <div className="space-y-6">
      <PeriodPicker autoGranularity={auto} error={period.error} onChange={change} value={state} />
      {period.error ? null : isError ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : loading || !report ? (
        <ReportSkeleton />
      ) : report.members.length === 0 ? (
        <Empty
          description={t('team.empty_description')}
          icon={UsersIcon}
          title={t('team.empty_title')}
        />
      ) : (
        <>
          <TeamKpiGrid complete={report.to <= now} kpis={report.kpis} />
          <WorkedHoursChart
            from={report.from}
            granularity={report.granularity}
            now={now}
            series={report.series}
            title={t('chart.worked.team_title')}
            to={report.to}
          />
          <TeamMembersTable members={report.members} />
        </>
      )}
    </div>
  )
}
