import type { User } from '@time-manager/sdk'

import type { UserActor } from '@/features/users/lib/user-permissions'
import type { useRovingTabindex } from '@/hooks/use-roving-tabindex'

export type UserItemProps = {
  actor: UserActor
  getItemProps?: ReturnType<typeof useRovingTabindex>['getItemProps']
  index: number
  onArchive?: (user: User) => void
  onDelete?: (user: User) => void
  onEdit?: (user: User) => void
  onRestore?: (user: User) => void
  onSelect?: (id: string) => void
  onView?: (user: User) => void
  onViewReport?: (user: User) => void
  selected?: boolean
  user: User
}
