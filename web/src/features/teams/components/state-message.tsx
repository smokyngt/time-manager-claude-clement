import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function StateMessage({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  description: string
  icon: LucideIcon
  title: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden className="size-6" />
      </div>
      <h2 className="font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}
