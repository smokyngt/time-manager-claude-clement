import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-base shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive md:text-sm pointer-coarse:h-11',
        className,
      )}
      type={type}
      {...props}
    />
  )
}
