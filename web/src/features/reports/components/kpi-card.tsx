import type { LucideIcon } from 'lucide-react'

import { memo } from 'react'

import type { Tone } from '@/features/reports/lib/kpi'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'

export type KpiCardProps = {
  hint: string
  icon: LucideIcon
  label: string
  tone?: Tone
  value: string
}

export const KpiCard = memo(function KpiCard({ hint, icon: Icon, label, tone, value }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              'text-2xl font-semibold tracking-tight tabular-nums',
              tone === 'positive' && 'text-emerald-700 dark:text-emerald-400',
              tone === 'negative' && 'text-destructive',
            )}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon aria-hidden className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
})
