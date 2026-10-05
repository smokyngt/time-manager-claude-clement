import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  LayoutDashboardIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

export type TeamActionsProps = {
  dashboardTo?: string
  onArchive?: () => void
  onDelete?: () => void
  onEdit?: () => void
  onRestore?: () => void
}

export function TeamActions({
  dashboardTo,
  onArchive,
  onDelete,
  onEdit,
  onRestore,
}: TeamActionsProps) {
  const { t } = useTranslation('teams')

  return (
    <>
      {dashboardTo ? (
        <Button asChild variant="outline">
          <Link to={dashboardTo}>
            <LayoutDashboardIcon />
            {t('actions.dashboard')}
          </Link>
        </Button>
      ) : null}
      {onEdit ? (
        <Button onClick={onEdit} variant="outline">
          <PencilIcon />
          {t('common:actions.edit')}
        </Button>
      ) : null}
      {onArchive ? (
        <Button onClick={onArchive} variant="outline">
          <ArchiveIcon />
          {t('common:actions.archive')}
        </Button>
      ) : null}
      {onRestore ? (
        <Button onClick={onRestore} variant="outline">
          <ArchiveRestoreIcon />
          {t('common:actions.restore')}
        </Button>
      ) : null}
      {onDelete ? (
        <Button onClick={onDelete} variant="destructive">
          <Trash2Icon />
          {t('common:actions.delete')}
        </Button>
      ) : null}
    </>
  )
}
