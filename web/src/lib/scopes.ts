import type { Scope } from '@time-manager/sdk'

export const RESOURCE_SCOPES = {
  clocks: { manage: 'clocks:manage', read: 'clocks:read', write: 'clocks:write' },
  reports: { read: 'reports:read' },
  teams: { manage: 'teams:manage', read: 'teams:read' },
  users: { manage: 'users:manage', read: 'users:read', write: 'users:write' },
} as const satisfies Record<string, Partial<Record<string, Scope>>>
