import { z } from 'zod'

import type { CreateTeamBody, Team, UpdateTeamData } from '@/features/teams/api/types'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const teamFields = z.object({
  description: z.string().trim().max(500, 'Description must be at most 500 characters'),
  manager_id: z.string().min(1, 'Choose a manager'),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  weekly_hours_target: z
    .number({ error: 'Enter a number of hours' })
    .int('Enter a whole number of hours')
    .min(1, 'Minimum is 1 hour')
    .max(80, 'Maximum is 80 hours'),
  work_end: z.string().regex(TIME_PATTERN, 'Enter a valid time'),
  work_start: z.string().regex(TIME_PATTERN, 'Enter a valid time'),
})

function endsAfterStart(value: { work_end: string; work_start: string }) {
  return value.work_end > value.work_start
}

const END_AFTER_START = { error: 'End must be after start', path: ['work_end'] }

export const teamSchema = teamFields.refine(endsAfterStart, END_AFTER_START)

export type TeamValues = z.infer<typeof teamSchema>

export const TEAM_DEFAULTS: TeamValues = {
  description: '',
  manager_id: '',
  name: '',
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
}

export function teamToValues(team: Team): TeamValues {
  return {
    description: team.description ?? '',
    manager_id: team.manager_id,
    name: team.name,
    weekly_hours_target: team.weekly_hours_target,
    work_end: team.work_end,
    work_start: team.work_start,
  }
}

export function toCreateBody(values: TeamValues): CreateTeamBody {
  const { description, ...rest } = values
  return description ? { ...rest, description } : rest
}

export function toUpdateData(values: TeamValues, team: Team, can_change_manager: boolean) {
  const { manager_id, ...rest } = values
  const data: UpdateTeamData = { ...rest, description: values.description || null }
  if (can_change_manager && manager_id !== team.manager_id) data.manager_id = manager_id
  return data
}
