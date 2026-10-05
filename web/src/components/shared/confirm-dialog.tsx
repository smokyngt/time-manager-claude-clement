import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type ConfirmDialogProps = {
  cancelLabel?: string
  confirmLabel?: string
  description?: string
  loading?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  loading = false,
  onConfirm,
  onOpenChange,
  open,
  title,
  variant = 'default',
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? t('confirm.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => {
              onOpenChange(false)
            }}
            type="button"
            variant="outline"
          >
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button disabled={loading} onClick={onConfirm} type="button" variant={variant}>
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
