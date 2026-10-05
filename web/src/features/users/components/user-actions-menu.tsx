import type { User } from '@time-manager/sdk'

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChartColumnIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { UserItemProps } from '@/features/users/components/user-item-props'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserPermissions } from '@/features/users/lib/user-permissions'
import { UserSearch } from '@/features/users/lib/user-search'

export type UserActionsMenuProps = Pick<
  UserItemProps,
  'actor' | 'onArchive' | 'onDelete' | 'onEdit' | 'onRestore' | 'onView' | 'onViewReport'
> & { user: User }

export function UserActionsMenu({
  actor,
  onArchive,
  onDelete,
  onEdit,
  onRestore,
  onView,
  onViewReport,
  user,
}: UserActionsMenuProps) {
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')
  const archived = user.archivedAt !== null
  const canView = onView !== undefined
  const canReport = onViewReport !== undefined && UserPermissions.canReport(actor, user)
  const canEdit = onEdit !== undefined && !archived && UserPermissions.canEdit(actor, user)
  const canArchive =
    onArchive !== undefined && !archived && UserPermissions.canArchive(actor, user)
  const canRestore =
    onRestore !== undefined && archived && UserPermissions.canRestore(actor, user)
  const canDelete = onDelete !== undefined && UserPermissions.canDelete(actor, user)
  const hasSafe = canView || canReport || canEdit || canArchive || canRestore

  if (!hasSafe && !canDelete) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t('list.actions_for', { name: UserSearch.name(user) })}
          className="pointer-coarse:size-11"
          size="icon"
          variant="ghost"
        >
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canView ? (
          <DropdownMenuItem
            onSelect={() => {
              onView(user)
            }}
          >
            <EyeIcon aria-hidden />
            {tc('actions.view')}
          </DropdownMenuItem>
        ) : null}
        {canReport ? (
          <DropdownMenuItem
            onSelect={() => {
              onViewReport(user)
            }}
          >
            <ChartColumnIcon aria-hidden />
            {t('actions.open_report')}
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem
            onSelect={() => {
              onEdit(user)
            }}
          >
            <PencilIcon aria-hidden />
            {tc('actions.edit')}
          </DropdownMenuItem>
        ) : null}
        {canArchive ? (
          <DropdownMenuItem
            onSelect={() => {
              onArchive(user)
            }}
          >
            <ArchiveIcon aria-hidden />
            {tc('actions.archive')}
          </DropdownMenuItem>
        ) : null}
        {canRestore ? (
          <DropdownMenuItem
            onSelect={() => {
              onRestore(user)
            }}
          >
            <ArchiveRestoreIcon aria-hidden />
            {tc('actions.restore')}
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <>
            {hasSafe ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                onDelete(user)
              }}
            >
              <Trash2Icon aria-hidden />
              {tc('actions.delete')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
