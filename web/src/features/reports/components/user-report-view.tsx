import { BarChart3Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Empty, ErrorState } from '@/components/shared'
import { KpiGrid } from '@/features/reports/components/kpi-grid'
import { LatenessChart } from '@/features/reports/components/lateness-chart'
import { PeriodPicker } from '@/features/reports/components/period-picker'
import { ReportSkeleton } from '@/features/reports/components/report-skeleton'
import { WorkedHoursChart } from '@/features/reports/components/worked-hours-chart'
import { usePeriod } from '@/features/reports/hooks/use-period'
import { useUserReport } from '@/features/reports/hooks/use-user-report'

export type UserReportViewProps = {
  userId: string
}

export function UserReportView({ userId }: UserReportViewProps) {
  const { t } = useTranslation('reports')
  const { auto, change, now, period, state } = usePeriod()
  const { error, isError, loading, refetch, report } = useUserReport(
    { from: period.from, granularity: period.granularity, to: period.to, userId },
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
      ) : report.kpis.daysWorked === 0 && report.kpis.workedMs === 0 ? (
        <Empty
          description={t('user.empty_description')}
          icon={BarChart3Icon}
          title={t('user.empty_title')}
        />
      ) : (
        <>
          <KpiGrid kpis={report.kpis} now={now} range={{ from: report.from, to: report.to }} />
          <div className="grid gap-4 lg:grid-cols-2">
            <WorkedHoursChart
              from={report.from}
              granularity={report.granularity}
              now={now}
              series={report.series}
              targetMs={report.kpis.targetMs}
              to={report.to}
            />
            <LatenessChart granularity={report.granularity} series={report.series} />
          </div>
        </>
      )}
    </div>
  )
}
