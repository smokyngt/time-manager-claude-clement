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

export const UserRow = memo(function UserRow({
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
    <div
      aria-labelledby={`user-${user.id}-name`}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected && 'border-primary',
        archived && 'opacity-80',
      )}
      role="listitem"
      {...getItemProps?.(index)}
    >
      {selectable ? (
        <Checkbox
          aria-label={t('list.select', { name })}
          checked={selected}
          className="pointer-coarse:size-6"
          onCheckedChange={() => {
            onSelect(user.id)
          }}
        />
      ) : null}
      <Avatar aria-hidden className="hidden sm:flex">
        <AvatarFallback>{UserSearch.initials(user)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" id={`user-${user.id}-name`}>
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
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 md:hidden">
          <RoleBadge role={user.role} />
          {archived ? <Badge variant="outline">{tc('state.archived')}</Badge> : null}
        </div>
      </div>
      <span className="hidden w-36 truncate text-sm text-muted-foreground lg:block">
        {user.phoneNumber ?? tc('state.none')}
      </span>
      <div className="hidden items-center gap-2 md:flex">
        <RoleBadge role={user.role} />
        {archived ? <Badge variant="outline">{tc('state.archived')}</Badge> : null}
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
  )
})
