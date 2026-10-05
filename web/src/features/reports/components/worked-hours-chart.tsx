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

import type { Granularity } from '@/features/reports/api/types'

import { ChartCard } from '@/features/reports/components/chart-card'
import { AXIS_TICK, TOOLTIP_STYLE } from '@/features/reports/lib/chart-style'
import { formatDuration } from '@/features/reports/lib/format'
import { formatPeriodLabel, formatShortPeriodLabel } from '@/features/reports/lib/labels'
import { buildChartPoints } from '@/features/reports/lib/series'

export function WorkedHoursChart({
  from,
  granularity,
  series,
  target_ms,
  title = 'Worked hours',
  to,
}: {
  from: number
  granularity: Granularity
  series: { period_start: number; worked_ms: number }[]
  target_ms?: number
  title?: string
  to: number
}) {
  const points = buildChartPoints(series, { from, granularity, target_ms, to })
  const data = points.map((point) => ({
    ...point,
    name: formatShortPeriodLabel(point.period_start, granularity),
  }))
  const has_target = target_ms !== undefined
  const total = series.reduce((sum, point) => sum + point.worked_ms, 0)
  const summary = `Bar chart of worked hours per ${granularity}, ${formatDuration(total)} in total${has_target ? ', with a dashed target line' : ''}`

  return (
    <ChartCard
      description={`Hours worked per ${granularity}${has_target ? ', dashed line is the target' : ''}`}
      summary={summary}
      table={{
        headers: has_target ? ['Period', 'Worked', 'Target'] : ['Period', 'Worked'],
        rows: points.map((point) => [
          formatPeriodLabel(point.period_start, granularity),
          formatDuration(point.worked_hours * 3_600_000),
          ...(has_target ? [formatDuration((point.target_hours ?? 0) * 3_600_000)] : []),
        ]),
      }}
      title={title}
    >
      <ResponsiveContainer height="100%" width="100%">
        <ComposedChart data={data} margin={{ bottom: 0, left: -20, right: 8, top: 8 }}>
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
            formatter={(value) => formatDuration(Number(value) * 3_600_000)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="worked_hours"
            fill="var(--chart-1)"
            maxBarSize={36}
            name="Worked"
            radius={[6, 6, 0, 0]}
          />
          {has_target ? (
            <Line
              dataKey="target_hours"
              dot={false}
              name="Target"
              stroke="var(--foreground)"
              strokeDasharray="6 4"
              strokeWidth={2}
              type="monotone"
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
