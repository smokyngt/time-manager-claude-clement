import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Theme } from '@/stores/preferences'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/providers/use-theme'

const THEMES: { icon: typeof SunIcon; value: Theme }[] = [
  { icon: SunIcon, value: 'light' },
  { icon: MoonIcon, value: 'dark' },
  { icon: MonitorIcon, value: 'system' },
]

function isTheme(value: string): value is Theme {
  return THEMES.some((theme) => theme.value === value)
}

export function ThemeToggle() {
  const { t } = useTranslation('common')
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`${t('theme.label')} (${t(`theme.${theme}`)})`}
          size="icon"
          variant="ghost"
        >
          <SunIcon className="dark:hidden" />
          <MoonIcon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (isTheme(value)) {
              setTheme(value)
            }
          }}
          value={theme}
        >
          {THEMES.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <item.icon />
              {t(`theme.${item.value}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
