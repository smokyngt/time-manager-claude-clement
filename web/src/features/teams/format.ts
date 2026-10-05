import type { Team } from '@/features/teams/api/types'

export function formatSchedule(team: Pick<Team, 'work_end' | 'work_start'>) {
  return `${team.work_start}–${team.work_end}`
}

export function formatWeeklyTarget(team: Pick<Team, 'weekly_hours_target'>) {
  return `${team.weekly_hours_target} h / week`
}
