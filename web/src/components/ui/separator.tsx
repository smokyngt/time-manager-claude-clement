import type { ComponentProps } from 'react'

import { Separator as SeparatorPrimitive } from 'radix-ui'

import { cn } from '@/lib/cn'

export function Separator({
  className,
  decorative = true,
  orientation = 'horizontal',
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      decorative={decorative}
      orientation={orientation}
      {...props}
    />
  )
}
