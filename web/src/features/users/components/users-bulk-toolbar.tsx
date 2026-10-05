import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import { Button } from '@/components/ui/button'

export type UsersBulkToolbarProps = {
  count: number
  disabled?: boolean
  onArchive?: () => void
  onClear: () => void
  onDelete?: () => void
  onRestore?: () => void
  onSelectAll?: () => void
}

export function UsersBulkToolbar({
  count,
  disabled = false,
  onArchive,
  onClear,
  onDelete,
  onRestore,
  onSelectAll,
}: UsersBulkToolbarProps) {
  const { t } = useTranslation('users')

  return (
    <BulkActionBar count={count} onClear={onClear} onSelectAll={onSelectAll}>
      {onArchive ? (
        <Button disabled={disabled} onClick={onArchive} size="sm" variant="outline">
          <ArchiveIcon aria-hidden />
          {t('bulk.archive')}
        </Button>
      ) : null}
      {onRestore ? (
        <Button disabled={disabled} onClick={onRestore} size="sm" variant="outline">
          <ArchiveRestoreIcon aria-hidden />
          {t('bulk.restore')}
        </Button>
      ) : null}
      {onDelete ? (
        <Button disabled={disabled} onClick={onDelete} size="sm" variant="destructive">
          <Trash2Icon aria-hidden />
          {t('bulk.delete')}
        </Button>
      ) : null}
    </BulkActionBar>
  )
}
