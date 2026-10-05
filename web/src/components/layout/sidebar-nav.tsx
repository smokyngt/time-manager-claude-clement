import { Link, useLocation } from 'react-router'

import type { NavItem } from '@/components/layout/nav-items'

import { NAV_ITEMS } from '@/components/layout/nav-items'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth/use-auth'
import { cn } from '@/lib/utils'

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isActive = (item: NavItem) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to)
  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)))

  return (
    <nav aria-label="Main" className="flex flex-col gap-1 p-3">
      {items.map((item) => (
        <Tooltip key={item.to}>
          <TooltipTrigger asChild>
            <Link
              aria-current={isActive(item) ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isActive(item) && 'bg-accent text-accent-foreground',
              )}
              onClick={onNavigate}
              to={item.to}
            >
              <item.icon aria-hidden className="size-4 shrink-0" />
              <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
            </Link>
          </TooltipTrigger>
          {collapsed ? <TooltipContent side="right">{item.label}</TooltipContent> : null}
        </Tooltip>
      ))}
    </nav>
  )
}
