import type { ReactNode } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/use-media-query'

export type ResponsiveDetailProps = {
  children: ReactNode
  description?: string
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

export function ResponsiveDetail({
  children,
  description,
  onOpenChange,
  open,
  title,
}: ResponsiveDetailProps) {
  const desktop = useMediaQuery('(min-width: 768px)')

  if (desktop) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={description ? undefined : 'sr-only'}>
              {description ?? title}
            </DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full max-w-full overflow-y-auto p-4">
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription className={description ? undefined : 'sr-only'}>
          {description ?? title}
        </SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  )
}
