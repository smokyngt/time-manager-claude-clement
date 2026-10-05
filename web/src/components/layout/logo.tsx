import { ClockIcon } from 'lucide-react'

import { cn } from '@/lib/cn'

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <ClockIcon aria-hidden className="size-4.5" />
      </div>
      <span className={cn('text-base font-semibold tracking-tight', collapsed && 'sr-only')}>
        Time Manager
      </span>
    </div>
  )
}
