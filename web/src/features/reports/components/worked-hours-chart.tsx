import type { Granularity } from '@time-manager/sdk'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartCard } from '@/features/reports/components/chart-card'
import { usePeriodLabels } from '@/features/reports/hooks/use-period-labels'
import { AXIS_TICK, TOOLTIP_STYLE } from '@/features/reports/lib/chart-style'
import { buildChartPoints } from '@/features/reports/lib/series'
import { Duration } from '@/lib/duration'

export type WorkedHoursChartProps = {
  from: number
  granularity: Granularity
  now: number
  series: { periodStart: number; workedMs: number }[]
  targetMs?: number
  title?: string
  to: number
}

export function WorkedHoursChart({
  from,
  granularity,
  now,
  series,
  targetMs,
  title,
  to,
}: WorkedHoursChartProps) {
  const { t } = useTranslation('reports')
  const labels = usePeriodLabels()
  const hasTarget = targetMs !== undefined
  const unit = labels.unit(granularity)

  const points = useMemo(
    () => buildChartPoints(series, { from, granularity, now, targetMs, to }),
    [series, from, granularity, now, targetMs, to],
  )
  const data = useMemo(
    () => points.map((point) => ({ ...point, name: labels.axis(point.periodStart) })),
    [points, labels],
  )
  const total = series.reduce((sum, point) => sum + point.workedMs, 0)
  const rows = points.map((point) => [
    labels.full(point.periodStart, granularity),
    Duration.short(Duration.fromHours(point.workedHours)),
    ...(hasTarget ? [Duration.short(Duration.fromHours(point.targetHours ?? 0))] : []),
  ])

  return (
    <ChartCard
      description={t(hasTarget ? 'chart.worked.description_target' : 'chart.worked.description', {
        unit,
      })}
      empty={total === 0}
      summary={t(hasTarget ? 'chart.worked.summary_target' : 'chart.worked.summary', {
        total: Duration.short(total),
        unit,
      })}
      table={{
        headers: [
          t('chart.period'),
          t('chart.worked.series'),
          ...(hasTarget ? [t('chart.worked.target')] : []),
        ],
        rows,
      }}
      title={title ?? t('chart.worked.title')}
    >
      <ResponsiveContainer height="100%" width="100%">
        <ComposedChart
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
          <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} unit="h" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'var(--muted)' }}
            formatter={(value) => Duration.short(Duration.fromHours(Number(value)))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="workedHours"
            fill="var(--chart-1)"
            maxBarSize={36}
            name={t('chart.worked.series')}
            radius={[6, 6, 0, 0]}
          />
          {hasTarget ? (
            <Line
              dataKey="targetHours"
              dot={false}
              name={t('chart.worked.target')}
              stroke="var(--foreground)"
              strokeDasharray="6 4"
              strokeWidth={2}
              type="stepAfter"
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
