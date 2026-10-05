import { describe, expect, it } from 'vitest'

import { QueryKeys } from '@/config/query-keys'

function startsWith(key: readonly unknown[], prefix: readonly unknown[]) {
  return prefix.every((part, index) => JSON.stringify(key[index]) === JSON.stringify(part))
}

describe('QueryKeys', () => {
  it('builds hierarchical keys', () => {
    expect(startsWith(QueryKeys.teams({ q: 'a' }), QueryKeys.teams())).toBe(true)
    expect(startsWith(QueryKeys.teams(), QueryKeys.teamsAll())).toBe(true)
    expect(startsWith(QueryKeys.team('1'), QueryKeys.teamsAll())).toBe(true)
    expect(startsWith(QueryKeys.teamMembers('1'), QueryKeys.team('1'))).toBe(true)
    expect(startsWith(QueryKeys.teamMembers('1', { limit: 5 }), QueryKeys.teamMembers('1'))).toBe(
      true,
    )
    expect(startsWith(QueryKeys.users({ q: 'a' }), QueryKeys.users())).toBe(true)
    expect(startsWith(QueryKeys.user('1'), QueryKeys.usersAll())).toBe(true)
    expect(startsWith(QueryKeys.clocks({ open: true }), QueryKeys.clocksAll())).toBe(true)
    expect(startsWith(QueryKeys.currentClock(), QueryKeys.clocksAll())).toBe(true)
    expect(startsWith(QueryKeys.userReport({ userId: '1' }), QueryKeys.reportsAll())).toBe(true)
    expect(startsWith(QueryKeys.teamReport({ teamId: '1' }), QueryKeys.reportsAll())).toBe(true)
  })

  it('keeps lists and details apart', () => {
    expect(startsWith(QueryKeys.team('1'), QueryKeys.teams())).toBe(false)
    expect(startsWith(QueryKeys.user('1'), QueryKeys.users())).toBe(false)
    expect(startsWith(QueryKeys.userReport(), QueryKeys.teamReport())).toBe(false)
  })

  it('separates entities by id and filters', () => {
    expect(QueryKeys.team('1')).not.toEqual(QueryKeys.team('2'))
    expect(QueryKeys.teams({ q: 'a' })).not.toEqual(QueryKeys.teams({ q: 'b' }))
    expect(QueryKeys.me()).toEqual(['me'])
  })
})
