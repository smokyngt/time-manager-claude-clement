import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    defaultVariants: { variant: 'default' },
    variants: {
      variant: {
        default: 'border-transparent bg-accent text-accent-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-success/15 text-success',
      },
    },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
