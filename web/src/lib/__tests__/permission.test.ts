import { describe, expect, it } from 'vitest'

import { Permission } from '@/lib/permission'
import { RESOURCE_SCOPES } from '@/lib/scopes'

describe('Permission.scope', () => {
  const scopes = ['teams:read', 'users:read']

  it('any is true when one scope matches', () => {
    expect(Permission.scope.any(scopes, ['teams:manage', 'teams:read'])).toBe(true)
    expect(Permission.scope.any(scopes, ['teams:manage'])).toBe(false)
    expect(Permission.scope.any(scopes, [])).toBe(false)
  })

  it('all needs every scope', () => {
    expect(Permission.scope.all(scopes, ['teams:read', 'users:read'])).toBe(true)
    expect(Permission.scope.all(scopes, ['teams:read', 'teams:manage'])).toBe(false)
    expect(Permission.scope.all(scopes, [])).toBe(true)
  })
})

describe('RESOURCE_SCOPES', () => {
  it('mirrors the API scopes', () => {
    expect(RESOURCE_SCOPES).toEqual({
      clocks: { manage: 'clocks:manage', read: 'clocks:read', write: 'clocks:write' },
      reports: { read: 'reports:read' },
      teams: { manage: 'teams:manage', read: 'teams:read' },
      users: { manage: 'users:manage', read: 'users:read', write: 'users:write' },
    })
  })
})
