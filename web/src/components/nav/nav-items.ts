import type { Scope } from '@time-manager/sdk'
import type { LucideIcon } from 'lucide-react'

import { ClockIcon, LayoutDashboardIcon, UserIcon, UsersIcon, UsersRoundIcon } from 'lucide-react'

import { RESOURCE_SCOPES } from '@/lib/scopes'

export type NavItem = {
  end?: boolean
  icon: LucideIcon
  labelKey: string
  scopes?: Scope[]
  to: string
}

export const NAV_ITEMS: NavItem[] = [
  { end: true, icon: LayoutDashboardIcon, labelKey: 'dashboard', to: '/' },
  { icon: ClockIcon, labelKey: 'clocks', scopes: [RESOURCE_SCOPES.clocks.read], to: '/clocks' },
  { icon: UsersRoundIcon, labelKey: 'teams', scopes: [RESOURCE_SCOPES.teams.read], to: '/teams' },
  { icon: UsersIcon, labelKey: 'users', scopes: [RESOURCE_SCOPES.users.manage], to: '/users' },
  { icon: UserIcon, labelKey: 'profile', to: '/me' },
]
