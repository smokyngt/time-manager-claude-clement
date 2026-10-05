import type { Granularity, UserReportPoint } from '@time-manager/sdk'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartCard } from '@/features/reports/components/chart-card'
import { usePeriodLabels } from '@/features/reports/hooks/use-period-labels'
import { AXIS_TICK, TOOLTIP_STYLE } from '@/features/reports/lib/chart-style'

export type LatenessChartProps = {
  granularity: Granularity
  series: UserReportPoint[]
}

export function LatenessChart({ granularity, series }: LatenessChartProps) {
  const { t } = useTranslation('reports')
  const labels = usePeriodLabels()
  const unit = labels.unit(granularity)
  const data = useMemo(
    () => series.map((point) => ({ late: point.late, name: labels.axis(point.periodStart) })),
    [series, labels],
  )
  const total = series.reduce((sum, point) => sum + point.late, 0)

  return (
    <ChartCard
      description={t('chart.lateness.description', { unit })}
      empty={total === 0}
      summary={t('chart.lateness.summary', { total, unit })}
      table={{
        headers: [t('chart.period'), t('chart.lateness.series')],
        rows: series.map((point) => [
          labels.full(point.periodStart, granularity),
          String(point.late),
        ]),
      }}
      title={t('chart.lateness.title')}
    >
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ bottom: 0, left: -20, right: 8, top: 8 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="name"
            minTickGap={16}
            tick={AXIS_TICK}
            tickLine={false}
          />
          <YAxis allowDecimals={false} axisLine={false} tick={AXIS_TICK} tickLine={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'var(--muted)' }}
            formatter={(value) => [String(value), t('chart.lateness.series')]}
          />
          <Bar
            dataKey="late"
            fill="var(--chart-2)"
            maxBarSize={36}
            name={t('chart.lateness.series')}
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
