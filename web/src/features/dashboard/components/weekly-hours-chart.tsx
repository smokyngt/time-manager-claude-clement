import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const WEEKLY_HOURS = [
  { day: 'Mon', hours: 7.5 },
  { day: 'Tue', hours: 8 },
  { day: 'Wed', hours: 6.5 },
  { day: 'Thu', hours: 8.5 },
  { day: 'Fri', hours: 7 },
  { day: 'Sat', hours: 0 },
  { day: 'Sun', hours: 0 },
]

export function WeeklyHoursChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly hours</CardTitle>
        <CardDescription>Hours worked per day, sample data</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          aria-label="Bar chart of hours worked per day this week"
          className="h-64 w-full"
          role="img"
        >
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={WEEKLY_HOURS} margin={{ bottom: 0, left: -20, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="day"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickLine={false}
                unit="h"
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--popover-foreground)',
                  fontSize: 12,
                }}
                cursor={{ fill: 'var(--muted)' }}
                formatter={(value) => [`${String(value)}h`, 'Hours']}
              />
              <Bar dataKey="hours" fill="var(--chart-1)" maxBarSize={36} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
