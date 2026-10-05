import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import type { Clock } from '@/features/clocks/api/types'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeleteClock } from '@/features/clocks/hooks/use-clock-mutations'
import { formatClockTime, formatDateLabel } from '@/features/clocks/lib/format'
import { getErrorMessage } from '@/lib/api/errors'

export function DeleteEntryDialog({
  clock,
  onClose,
}: {
  clock: Clock
  onClose: () => void
}) {
  const { isPending, mutateAsync } = useDeleteClock()

  async function confirm() {
    try {
      const result = await mutateAsync(clock.id)
      if (result.failed.length > 0) throw new Error('This entry could not be deleted')
      toast.success('Entry deleted')
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      open
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete entry</DialogTitle>
          <DialogDescription>
            {`Delete the entry of ${formatDateLabel(clock.clocked_in_at)} (${formatClockTime(clock.clocked_in_at)} - ${formatClockTime(clock.clocked_out_at)})? This cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              void confirm()
            }}
            variant="destructive"
          >
            {isPending ? <Loader2Icon className="animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
