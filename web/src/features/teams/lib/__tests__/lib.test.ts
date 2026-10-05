import { TimeManagerError } from '@time-manager/sdk'
import { describe, expect, it } from 'vitest'

import { TeamFixtures } from '@/features/teams/__tests__/fixtures'
import { Pages } from '@/features/teams/lib/pages'
import { TeamBulk } from '@/features/teams/lib/team-bulk'
import { TeamFormat } from '@/features/teams/lib/team-format'
import { TeamMapper } from '@/features/teams/lib/team-mapper'
import { TeamPermission } from '@/features/teams/lib/team-permission'
import { TeamRoles } from '@/features/teams/lib/team-roles'
import { teamSchema } from '@/features/teams/lib/team-schema'
import { TestAuth } from '@/test-support/test-auth'

const valid = TeamMapper.defaults('manager-1')

describe('teamSchema', () => {
  it('trims the text fields', () => {
    const parsed = teamSchema.parse({ ...valid, description: '  hi  ', name: '  Ops  ' })
    expect(parsed.name).toBe('Ops')
    expect(parsed.description).toBe('hi')
  })

  it.each([
    ['name', { name: '   ' }, 'form.errors.name_required'],
    ['name', { name: 'a'.repeat(101) }, 'form.errors.name_max'],
    ['description', { description: 'a'.repeat(501) }, 'form.errors.description_max'],
    ['weeklyHoursTarget', { weeklyHoursTarget: 0 }, 'form.errors.hours_range'],
    ['weeklyHoursTarget', { weeklyHoursTarget: 81 }, 'form.errors.hours_range'],
    ['weeklyHoursTarget', { weeklyHoursTarget: 35.5 }, 'form.errors.hours_invalid'],
    ['workStart', { workStart: '25:00' }, 'form.errors.time_invalid'],
    ['workEnd', { workEnd: '09:00' }, 'form.errors.end_after_start'],
  ])('rejects an invalid %s', (field, patch, message) => {
    const result = teamSchema.safeParse({ ...valid, name: 'Ops', ...patch })
    expect(result.success).toBe(false)
    const issue = result.error?.issues.find((item) => item.path[0] === field)
    expect(issue?.message).toBe(message)
  })

  it('accepts the limits', () => {
    expect(
      teamSchema.safeParse({ ...valid, name: 'a'.repeat(100), weeklyHoursTarget: 80 }).success,
    ).toBe(true)
  })
})

describe('TeamMapper', () => {
  const team = TeamFixtures.team()

  it('prefills the form from a team', () => {
    expect(TeamMapper.fromTeam(team)).toEqual({
      description: 'Handles customer requests',
      managerId: 'manager-1',
      name: 'Support',
      weeklyHoursTarget: 35,
      workEnd: '17:00',
      workStart: '09:00',
    })
  })

  it('omits an empty description and the manager on create', () => {
    const params = TeamMapper.toCreate({ ...valid, name: 'Ops' }, false)
    expect(params).toEqual({
      name: 'Ops',
      weeklyHoursTarget: 35,
      workEnd: '17:00',
      workStart: '09:00',
    })
    expect(TeamMapper.toCreate({ ...valid, name: 'Ops' }, true).managerId).toBe('manager-1')
  })

  it('clears the description and only sends a changed manager on update', () => {
    const values = { ...TeamMapper.fromTeam(team), description: '', managerId: 'other' }
    expect(TeamMapper.toUpdate(values, team, true)).toMatchObject({
      description: null,
      managerId: 'other',
    })
    expect(TeamMapper.toUpdate(values, team, false)).not.toHaveProperty('managerId')
    expect(
      TeamMapper.toUpdate({ ...values, managerId: 'manager-1' }, team, true),
    ).not.toHaveProperty('managerId')
  })

  it('snapshots the editable fields', () => {
    expect(TeamMapper.snapshot(team, false)).not.toHaveProperty('managerId')
    expect(TeamMapper.snapshot(team, true).managerId).toBe('manager-1')
  })
})

describe('TeamPermission', () => {
  const admin = TestAuth.user({ id: 'a', role: 'admin' })
  const owner = TestAuth.user({ id: 'manager-1', role: 'manager' })
  const other = TestAuth.user({ id: 'm2', role: 'manager' })
  const employee = TestAuth.user({ id: 'e', role: 'employee' })
  const team = TeamFixtures.team()

  it('lets admins manage every team and managers their own', () => {
    expect(TeamPermission.canManage(TestAuth.scopes('admin'), admin, team)).toBe(true)
    expect(TeamPermission.canManage(TestAuth.scopes('manager'), owner, team)).toBe(true)
    expect(TeamPermission.canManage(TestAuth.scopes('manager'), other, team)).toBe(false)
  })

  it('requires the manage scope', () => {
    expect(TeamPermission.canManage(TestAuth.scopes('employee'), employee, team)).toBe(false)
    expect(TeamPermission.canManage([], null, team)).toBe(false)
    expect(TeamPermission.canCreate(TestAuth.scopes('employee'))).toBe(false)
    expect(TeamPermission.canCreate(TestAuth.scopes('manager'))).toBe(true)
  })

  it('reserves deletion and the manager picker to admins', () => {
    expect(TeamPermission.canDelete(TestAuth.scopes('admin'), admin)).toBe(true)
    expect(TeamPermission.canDelete(TestAuth.scopes('manager'), owner)).toBe(false)
    expect(TeamPermission.canPickManager(admin)).toBe(true)
    expect(TeamPermission.canPickManager(owner)).toBe(false)
  })
})

describe('helpers', () => {
  it('formats the schedule and names', () => {
    expect(TeamFormat.schedule(TeamFixtures.team())).toBe('09:00–17:00')
    expect(TeamFormat.userName({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe')
  })

  it('picks the roles', () => {
    expect(TeamRoles.managers()).toEqual(['admin', 'manager'])
    expect(TeamRoles.memberCandidates('admin')).toEqual(['admin', 'employee', 'manager'])
    expect(TeamRoles.memberCandidates('manager')).toEqual(['employee'])
  })

  it('throws the first failure only when nothing succeeded', () => {
    const failed = [{ code: 'team.not.found', id: 'x' }]
    expect(() => {
      TeamBulk.assertSome(0, failed)
    }).toThrow(TimeManagerError)
    expect(() => {
      TeamBulk.assertSome(1, failed)
    }).not.toThrow()
    expect(() => {
      TeamBulk.assertSome(0, [])
    }).not.toThrow()
  })

  it('collects every page', async () => {
    const pages = [
      { items: [1], more: true, next: 'c', total: 2 },
      { items: [2], more: false, next: null, total: 2 },
    ]
    let call = 0
    const result = await Pages.all(() =>
      Promise.resolve(
        pages[Math.min(call++, 1)] ?? { items: [], more: false, next: null, total: 0 },
      ),
    )
    expect(result).toEqual({ items: [1, 2], total: 2 })
  })
})
