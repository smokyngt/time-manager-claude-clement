import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import type { UserItemProps } from '@/features/users/components/user-item-props'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RoleBadge } from '@/features/users/components/role-badge'
import { UserActionsMenu } from '@/features/users/components/user-actions-menu'
import { UserPermissions } from '@/features/users/lib/user-permissions'
import { UserSearch } from '@/features/users/lib/user-search'
import { cn } from '@/lib/cn'

export const UserCard = memo(function UserCard({
  actor,
  getItemProps,
  index,
  onArchive,
  onDelete,
  onEdit,
  onRestore,
  onSelect,
  onView,
  onViewReport,
  selected = false,
  user,
}: UserItemProps) {
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')
  const name = UserSearch.name(user)
  const archived = user.archivedAt !== null
  const selectable = onSelect !== undefined && UserPermissions.canSelect(actor, user)

  return (
    <article
      aria-labelledby={`user-${user.id}-name`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected && 'border-primary',
        archived && 'opacity-80',
      )}
      role="listitem"
      {...getItemProps?.(index)}
    >
      <div className="flex items-start gap-3">
        {selectable ? (
          <Checkbox
            aria-label={t('list.select', { name })}
            checked={selected}
            className="mt-1 pointer-coarse:size-6"
            onCheckedChange={() => {
              onSelect(user.id)
            }}
          />
        ) : null}
        <Avatar aria-hidden>
          <AvatarFallback>{UserSearch.initials(user)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium" id={`user-${user.id}-name`}>
            {onView ? (
              <button
                className="max-w-full truncate text-left hover:underline focus-visible:underline focus-visible:outline-none"
                onClick={() => {
                  onView(user)
                }}
                type="button"
              >
                {name}
              </button>
            ) : (
              name
            )}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <UserActionsMenu
          actor={actor}
          onArchive={onArchive}
          onDelete={onDelete}
          onEdit={onEdit}
          onRestore={onRestore}
          onView={onView}
          onViewReport={onViewReport}
          user={user}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RoleBadge role={user.role} />
        {archived ? <Badge variant="outline">{tc('state.archived')}</Badge> : null}
        {user.phoneNumber ? (
          <span className="text-sm text-muted-foreground">{user.phoneNumber}</span>
        ) : null}
      </div>
    </article>
  )
})
