import type { LucideIcon } from 'lucide-react'

import { CalendarCheckIcon, ClockIcon, TimerIcon, TrendingUpIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

interface Kpi {
  hint: string
  icon: LucideIcon
  label: string
  value: string
}

const KPIS: Kpi[] = [
  { hint: 'of 40h target', icon: ClockIcon, label: 'Hours this week', value: '32.5h' },
  { hint: 'last 30 days', icon: TimerIcon, label: 'Average per day', value: '7h 12m' },
  { hint: 'this month', icon: CalendarCheckIcon, label: 'Days worked', value: '14' },
  { hint: 'vs last week', icon: TrendingUpIcon, label: 'Overtime', value: '+2.5h' },
]

export function KpiCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {KPIS.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </div>
            <div className="hidden size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground sm:grid">
              <kpi.icon aria-hidden className="size-4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
