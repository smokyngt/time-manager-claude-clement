import type { Team, TeamRole } from '@/features/teams/api/types'

interface Actor {
  id: string
  role: TeamRole
}

export function canCreateTeam(actor: Actor | null) {
  return actor?.role === 'admin' || actor?.role === 'manager'
}

export function canDeleteTeam(actor: Actor | null) {
  return actor?.role === 'admin'
}

export function canManageTeam(actor: Actor | null, team: Pick<Team, 'manager_id'>) {
  if (!actor) return false
  return actor.role === 'admin' || (actor.role === 'manager' && team.manager_id === actor.id)
}

export function memberCandidateRoles(actor: Actor | null): TeamRole[] {
  return actor?.role === 'admin' ? ['admin', 'employee', 'manager'] : ['employee']
}
