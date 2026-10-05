import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { Logo } from '@/components/layout/logo'
import { SidebarNav, ThemeToggle, UserMenu } from '@/components/nav'
import { LanguageToggle } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

const STORAGE_KEY = 'tm-sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppLayout() {
  const { t } = useTranslation(['common', 'nav'])
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobile_open, setMobileOpen] = useState(false)

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      return
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <a
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        href="#main"
      >
        {t('common:skip_to_content')}
      </a>
      <div className="flex min-h-dvh">
        <aside
          className={cn(
            'sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          <div
            className={cn(
              'flex h-14 items-center border-b px-4',
              collapsed && 'justify-center px-0',
            )}
          >
            <Logo collapsed={collapsed} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav collapsed={collapsed} />
          </div>
        </aside>

        <Sheet onOpenChange={setMobileOpen} open={mobile_open}>
          <SheetContent>
            <SheetTitle className="sr-only">{t('nav:menu_title')}</SheetTitle>
            <SheetDescription className="sr-only">{t('nav:menu_description')}</SheetDescription>
            <div className="flex h-14 items-center border-b px-4">
              <Logo />
            </div>
            <SidebarNav
              onNavigate={() => {
                setMobileOpen(false)
              }}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:px-6">
            <Button
              aria-label={t('nav:open')}
              className="md:hidden"
              onClick={() => {
                setMobileOpen(true)
              }}
              size="icon"
              variant="ghost"
            >
              <MenuIcon />
            </Button>
            <Button
              aria-label={collapsed ? t('nav:expand') : t('nav:collapse')}
              aria-pressed={collapsed}
              className="hidden md:inline-flex"
              onClick={toggleCollapsed}
              size="icon"
              variant="ghost"
            >
              {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <LanguageToggle />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main
            className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-6 lg:p-8"
            id="main"
            tabIndex={-1}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
