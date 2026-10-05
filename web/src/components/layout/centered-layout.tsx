import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type CenteredLayoutProps = {
  children?: ReactNode
  className?: string
  description?: string
  icon?: LucideIcon
  standalone?: boolean
  title: string
}

export function CenteredLayout({
  children,
  className,
  description,
  icon: Icon,
  standalone = true,
  title,
}: CenteredLayoutProps) {
  const Root = standalone ? 'main' : 'div'

  return (
    <Root
      className={cn(
        'grid place-items-center p-4 text-center',
        standalone ? 'min-h-dvh bg-muted/40' : 'min-h-[60dvh]',
        className,
      )}
      id={standalone ? 'main' : undefined}
    >
      <div className="flex max-w-md flex-col items-center gap-4">
        {Icon ? <Icon aria-hidden className="size-10 text-muted-foreground" /> : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {children}
      </div>
    </Root>
  )
}
