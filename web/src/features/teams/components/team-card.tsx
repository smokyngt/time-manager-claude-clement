import type { Team } from '@time-manager/sdk'

import { ClockIcon, EyeIcon, MoreHorizontalIcon, UsersIcon } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TeamFormat } from '@/features/teams/lib/team-format'
import { cn } from '@/lib/cn'

export type TeamCardProps = {
  layout?: 'grid' | 'list'
  managerName?: string
  onArchive?: (team: Team) => void
  onDelete?: (team: Team) => void
  onEdit?: (team: Team) => void
  onPreview?: (team: Team) => void
  onRestore?: (team: Team) => void
  onToggle?: (id: string) => void
  selected?: boolean
  team: Team
}

type TeamAction = {
  destructive?: boolean
  key: string
  label: string
  run: () => void
}

export const TeamCard = memo(function TeamCard({
  layout = 'grid',
  managerName,
  onArchive,
  onDelete,
  onEdit,
  onPreview,
  onRestore,
  onToggle,
  selected = false,
  team,
}: TeamCardProps) {
  const { t } = useTranslation('teams')
  const archived = team.archivedAt !== null

  const actions: TeamAction[] = []
  if (onPreview) {
    actions.push({
      key: 'preview',
      label: t('actions.quick_view'),
      run: () => {
        onPreview(team)
      },
    })
  }
  if (onEdit) {
    actions.push({
      key: 'edit',
      label: t('common:actions.edit'),
      run: () => {
        onEdit(team)
      },
    })
  }
  if (onArchive) {
    actions.push({
      key: 'archive',
      label: t('common:actions.archive'),
      run: () => {
        onArchive(team)
      },
    })
  }
  if (onRestore) {
    actions.push({
      key: 'restore',
      label: t('common:actions.restore'),
      run: () => {
        onRestore(team)
      },
    })
  }
  if (onDelete) {
    actions.push({
      destructive: true,
      key: 'delete',
      label: t('common:actions.delete'),
      run: () => {
        onDelete(team)
      },
    })
  }
  const regular = actions.filter((action) => action.destructive !== true)
  const destructive = actions.filter((action) => action.destructive === true)
  const itemClass = (action: TeamAction) =>
    action.destructive === true ? 'text-destructive focus:text-destructive' : undefined

  const card = (
    <Card
      className={cn(
        'gap-3 p-4',
        layout === 'list' && 'flex-row items-center',
        selected && 'ring-2 ring-ring',
      )}
      data-selected={selected}
    >
      {onToggle ? (
        <Checkbox
          aria-label={t('card.select', { name: team.name })}
          checked={selected}
          onCheckedChange={() => {
            onToggle(team.id)
          }}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate font-semibold">
            <Link className="hover:underline focus-visible:underline" to={`/teams/${team.id}`}>
              {team.name}
            </Link>
          </h3>
          {archived ? <Badge variant="outline">{t('card.archived')}</Badge> : null}
        </div>
        {layout === 'grid' ? (
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {team.description ?? t('detail.no_description')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {managerName ? <span>{t('card.manager', { name: managerName })}</span> : null}
          <span className="flex items-center gap-1.5">
            <UsersIcon aria-hidden className="size-4" />
            {t('card.members', { count: team.memberCount })}
          </span>
          <span className="flex items-center gap-1.5">
            <ClockIcon aria-hidden className="size-4" />
            {TeamFormat.schedule(team)}
          </span>
        </div>
      </div>
      {actions.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={t('card.actions', { name: team.name })} size="icon" variant="ghost">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {regular.map((action) => (
              <DropdownMenuItem key={action.key} onSelect={action.run}>
                {action.key === 'preview' ? <EyeIcon aria-hidden /> : null}
                {action.label}
              </DropdownMenuItem>
            ))}
            {regular.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
            {destructive.map((action) => (
              <DropdownMenuItem
                className={itemClass(action)}
                key={action.key}
                onSelect={action.run}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </Card>
  )

  if (actions.length === 0) {
    return card
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>
        {regular.map((action) => (
          <ContextMenuItem key={action.key} onSelect={action.run}>
            {action.label}
          </ContextMenuItem>
        ))}
        {regular.length > 0 && destructive.length > 0 ? <ContextMenuSeparator /> : null}
        {destructive.map((action) => (
          <ContextMenuItem className={itemClass(action)} key={action.key} onSelect={action.run}>
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
})
