import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-card py-5 text-card-foreground shadow-xs',
        className,
      )}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 px-5', className)} {...props} />
}

export function CardTitle({
  as: Heading = 'h2',
  className,
  ...props
}: { as?: 'h2' | 'h3' | 'h4' } & ComponentProps<'h2'>) {
  return <Heading className={cn('text-base leading-none font-semibold', className)} {...props} />
}
