import { useParams } from 'react-router'

import { PageHeader } from '@/components/layout/page-header'
import { PeriodPicker } from '@/features/reports/components/period-picker'
import {
  ReportEmpty,
  ReportError,
  ReportSkeleton,
} from '@/features/reports/components/report-states'
import { TeamKpiGrid } from '@/features/reports/components/team-kpi-grid'
import { TeamMembersTable } from '@/features/reports/components/team-members-table'
import { WorkedHoursChart } from '@/features/reports/components/worked-hours-chart'
import { usePeriod } from '@/features/reports/hooks/use-period'
import { useTeamReport } from '@/features/reports/hooks/use-reports'

export function TeamReportPage() {
  const { id = '' } = useParams()
  const { auto, period, setState, state } = usePeriod()
  const query = useTeamReport(
    period.error
      ? null
      : { from: period.from, granularity: period.granularity, team_id: id, to: period.to },
  )
  const report = query.data

  return (
    <>
      <PageHeader description="Team KPIs and members" title="Team dashboard" />
      <PeriodPicker
        auto_granularity={auto}
        error={period.error}
        onChange={setState}
        value={state}
      />
      {period.error ? null : query.isError ? (
        <ReportError error={query.error} onRetry={() => void query.refetch()} />
      ) : !report ? (
        <ReportSkeleton />
      ) : report.members.length === 0 ? (
        <ReportEmpty message="This team has no members yet." />
      ) : (
        <>
          <TeamKpiGrid kpis={report.kpis} />
          <WorkedHoursChart
            from={report.from}
            granularity={report.granularity}
            series={report.series}
            title="Team worked hours"
            to={report.to}
          />
          <TeamMembersTable members={report.members} />
        </>
      )}
    </>
  )
}
