import type { TeamMember, TeamRole } from '@/features/teams/api/types'

import { fetchAllPages } from '@/features/teams/api/http'

export async function listUserOptions(roles: TeamRole[]) {
  const groups = await Promise.all(
    roles.map((role) => fetchAllPages<TeamMember>('/v1/users/list', { archived: false, role })),
  )
  return groups.flat().sort((a, b) => userName(a).localeCompare(userName(b)))
}

export function userName(user: Pick<TeamMember, 'first_name' | 'last_name'>) {
  return `${user.first_name} ${user.last_name}`.trim()
}
