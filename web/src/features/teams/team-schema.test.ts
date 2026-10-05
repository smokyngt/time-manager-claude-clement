import { describe, expect, it } from 'vitest'

import { teamSchema, toCreateBody, toUpdateData } from '@/features/teams/team-schema'
import { TEAM } from '@/features/teams/test-utils'

const VALID = {
  description: '',
  manager_id: 'manager-1',
  name: 'Platform',
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
}

function messages(values: object) {
  const result = teamSchema.safeParse({ ...VALID, ...values })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('teamSchema', () => {
  it('accepts a valid team', () => {
    expect(teamSchema.safeParse(VALID).success).toBe(true)
  })

  it('requires a name', () => {
    expect(messages({ name: '  ' })).toContain('Name is required')
  })

  it('requires work_end to be after work_start', () => {
    expect(messages({ work_end: '09:00' })).toContain('End must be after start')
    expect(messages({ work_end: '08:00' })).toContain('End must be after start')
  })

  it('bounds the weekly target between 1 and 80', () => {
    expect(messages({ weekly_hours_target: 0 })).toContain('Minimum is 1 hour')
    expect(messages({ weekly_hours_target: 81 })).toContain('Maximum is 80 hours')
    expect(messages({ weekly_hours_target: Number.NaN })).toContain('Enter a number of hours')
  })

  it('requires a manager', () => {
    expect(messages({ manager_id: '' })).toContain('Choose a manager')
  })
})

describe('payload mapping', () => {
  it('omits an empty description on create', () => {
    expect(toCreateBody(VALID)).not.toHaveProperty('description')
  })

  it('sends null for an empty description and only changes the manager when allowed', () => {
    const values = { ...VALID, manager_id: 'other' }
    expect(toUpdateData(values, TEAM, false)).toEqual({
      description: null,
      name: 'Platform',
      weekly_hours_target: 35,
      work_end: '17:00',
      work_start: '09:00',
    })
    expect(toUpdateData(values, TEAM, true)).toHaveProperty('manager_id', 'other')
  })
})
