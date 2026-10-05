import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function KpiCard({
  hint,
  icon: Icon,
  label,
  tone,
  value,
}: {
  hint: string
  icon: LucideIcon
  label: string
  tone?: 'negative' | 'positive'
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
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
        <div className="hidden size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground sm:grid">
          <Icon aria-hidden className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}
