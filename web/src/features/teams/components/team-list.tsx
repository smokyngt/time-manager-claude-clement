import type { Team } from '@time-manager/sdk'
import type { KeyboardEvent, ReactNode } from 'react'

import { UsersRoundIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ViewMode } from '@/stores/preferences'

import { Empty } from '@/components/shared/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { TeamCard } from '@/features/teams/components/team-card'
import { useRovingTabindex } from '@/hooks/use-roving-tabindex'
import { cn } from '@/lib/cn'

export type TeamListProps = {
  emptyAction?: ReactNode
  emptyDescription?: string
  emptyTitle?: string
  isManageable?: (team: Team) => boolean
  loading?: boolean
  managerNames?: Readonly<Record<string, string>>
  onArchive?: (team: Team) => void
  onDelete?: (team: Team) => void
  onEdit?: (team: Team) => void
  onPreview?: (team: Team) => void
  onRestore?: (team: Team) => void
  onToggle?: (id: string) => void
  selectedIds?: ReadonlySet<string>
  skeletonCount?: number
  teams: readonly Team[]
  viewMode?: ViewMode
}

const NO_SELECTION: ReadonlySet<string> = new Set()
const NO_NAMES: Readonly<Record<string, string>> = {}
const GRID_COLUMNS = 3

export function TeamList({
  emptyAction,
  emptyDescription,
  emptyTitle,
  isManageable = () => true,
  loading = false,
  managerNames = NO_NAMES,
  onArchive,
  onDelete,
  onEdit,
  onPreview,
  onRestore,
  onToggle,
  selectedIds = NO_SELECTION,
  skeletonCount = 6,
  teams,
  viewMode = 'grid',
}: TeamListProps) {
  const { t } = useTranslation('teams')
  const columns = viewMode === 'grid' ? GRID_COLUMNS : 1
  const { getItemProps } = useRovingTabindex(teams.length, { columns })
  const layoutClass = cn(
    'grid gap-4',
    viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
  )

  if (loading) {
    return (
      <div aria-busy className={layoutClass} role="status">
        <span className="sr-only">{t('common:state.loading')}</span>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <Skeleton className={viewMode === 'grid' ? 'h-36' : 'h-20'} key={index} />
        ))}
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <Empty
        action={emptyAction}
        description={emptyDescription ?? t('empty.description')}
        icon={UsersRoundIcon}
        title={emptyTitle ?? t('empty.title')}
      />
    )
  }

  const open = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && event.key === 'Enter') {
      event.currentTarget.querySelector('a')?.click()
    }
  }

  return (
    <ul aria-label={t('list.label')} className={layoutClass}>
      {teams.map((team, index) => {
        const manageable = isManageable(team)
        const archived = team.archivedAt !== null
        const itemProps = getItemProps(index)
        return (
          <li
            {...itemProps}
            className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            key={team.id}
            onKeyDown={(event) => {
              itemProps.onKeyDown(event)
              open(event)
            }}
          >
            <TeamCard
              layout={viewMode}
              managerName={managerNames[team.managerId]}
              onArchive={manageable && !archived ? onArchive : undefined}
              onDelete={manageable ? onDelete : undefined}
              onEdit={manageable ? onEdit : undefined}
              onPreview={onPreview}
              onRestore={manageable && archived ? onRestore : undefined}
              onToggle={manageable ? onToggle : undefined}
              selected={selectedIds.has(team.id)}
              team={team}
            />
          </li>
        )
      })}
    </ul>
  )
}
