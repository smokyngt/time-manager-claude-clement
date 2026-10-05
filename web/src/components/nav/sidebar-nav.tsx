import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'

import { isNavActive } from '@/components/nav/is-nav-active'
import { NAV_ITEMS } from '@/components/nav/nav-items'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { Permission } from '@/lib/permission'
import { useAuth } from '@/providers/use-auth'

export type SidebarNavProps = {
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation('nav')
  const { scopes } = useAuth()
  const { pathname } = useLocation()
  const items = NAV_ITEMS.filter(
    (item) => !item.scopes || Permission.scope.any(scopes, item.scopes),
  )

  return (
    <nav aria-label={t('main')} className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active = isNavActive(item, pathname)
        const label = t(item.labelKey)
        return (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active && 'bg-accent text-accent-foreground',
                )}
                onClick={onNavigate}
                to={item.to}
              >
                <item.icon aria-hidden className="size-4 shrink-0" />
                <span className={cn(collapsed && 'sr-only')}>{label}</span>
              </Link>
            </TooltipTrigger>
            {collapsed ? <TooltipContent side="right">{label}</TooltipContent> : null}
          </Tooltip>
        )
      })}
    </nav>
  )
}
