import type { LucideIcon } from 'lucide-react'

import { ClockIcon, LayoutDashboardIcon, UserIcon, UsersIcon, UsersRoundIcon } from 'lucide-react'

import type { Role } from '@/features/auth/api/auth'

export interface NavItem {
  end?: boolean
  icon: LucideIcon
  label: string
  roles?: Role[]
  to: string
}

export const NAV_ITEMS: NavItem[] = [
  { end: true, icon: LayoutDashboardIcon, label: 'Dashboard', to: '/' },
  { icon: ClockIcon, label: 'My clocks', to: '/clocks' },
  { icon: UsersRoundIcon, label: 'Teams', to: '/teams' },
  { icon: UsersIcon, label: 'Users', roles: ['manager', 'admin'], to: '/users' },
  { icon: UserIcon, label: 'My profile', to: '/me' },
]
