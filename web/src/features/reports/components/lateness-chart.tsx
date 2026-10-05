import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { Granularity, UserSeriesPoint } from '@/features/reports/api/types'

import { AXIS_TICK, ChartCard, TOOLTIP_STYLE } from '@/features/reports/components/chart-card'
import { formatPeriodLabel, formatShortPeriodLabel } from '@/features/reports/lib/labels'

export function LatenessChart({
  granularity,
  series,
}: {
  granularity: Granularity
  series: UserSeriesPoint[]
}) {
  const data = series.map((point) => ({
    late: point.late,
    name: formatShortPeriodLabel(point.period_start, granularity),
  }))
  const total = series.reduce((sum, point) => sum + point.late, 0)

  return (
    <ChartCard
      description={`Late arrivals per ${granularity}`}
      summary={`Bar chart of late arrivals per ${granularity}, ${total} in total`}
      table={{
        headers: ['Period', 'Late arrivals'],
        rows: series.map((point) => [
          formatPeriodLabel(point.period_start, granularity),
          String(point.late),
        ]),
      }}
      title="Lateness"
    >
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ bottom: 0, left: -20, right: 8, top: 8 }}>
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
            formatter={(value) => [String(value), 'Late arrivals']}
          />
          <Bar
            dataKey="late"
            fill="var(--chart-2)"
            maxBarSize={36}
            name="Late arrivals"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
