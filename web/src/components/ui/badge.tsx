import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cva } from 'class-variance-authority'

import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    defaultVariants: { variant: 'default' },
    variants: {
      variant: {
        admin: 'border-transparent bg-badge-admin text-badge-admin-foreground',
        default: 'border-transparent bg-accent text-accent-foreground',
        destructive: 'border-transparent bg-badge-destructive text-badge-destructive-foreground',
        employee: 'border-transparent bg-badge-employee text-badge-employee-foreground',
        manager: 'border-transparent bg-badge-manager text-badge-manager-foreground',
        muted: 'border-transparent bg-badge-muted text-badge-muted-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-badge-success text-badge-success-foreground',
        warning: 'border-transparent bg-badge-warning text-badge-warning-foreground',
      },
    },
  },
)

export { badgeVariants }

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
