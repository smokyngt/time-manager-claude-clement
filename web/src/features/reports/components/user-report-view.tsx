import { KpiGrid } from '@/features/reports/components/kpi-grid'
import { LatenessChart } from '@/features/reports/components/lateness-chart'
import { PeriodPicker } from '@/features/reports/components/period-picker'
import {
  ReportEmpty,
  ReportError,
  ReportSkeleton,
} from '@/features/reports/components/report-states'
import { WorkedHoursChart } from '@/features/reports/components/worked-hours-chart'
import { usePeriod } from '@/features/reports/hooks/use-period'
import { useUserReport } from '@/features/reports/hooks/use-reports'

export function UserReportView({ user_id }: { user_id: string }) {
  const { auto, period, setState, state } = usePeriod()
  const query = useUserReport(
    period.error
      ? null
      : { from: period.from, granularity: period.granularity, to: period.to, user_id },
  )
  const report = query.data

  return (
    <div className="space-y-4">
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
      ) : report.kpis.days_worked === 0 && report.kpis.worked_ms === 0 ? (
        <ReportEmpty message="No time tracked in this period." />
      ) : (
        <>
          <KpiGrid kpis={report.kpis} />
          <div className="grid gap-4 lg:grid-cols-2">
            <WorkedHoursChart
              from={report.from}
              granularity={report.granularity}
              series={report.series}
              target_ms={report.kpis.target_ms}
              to={report.to}
            />
            <LatenessChart granularity={report.granularity} series={report.series} />
          </div>
        </>
      )}
    </div>
  )
}
