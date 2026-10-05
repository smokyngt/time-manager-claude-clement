import type { ReactNode } from 'react'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Theme } from '@/lib/theme/theme-context'

import { ThemeContext } from '@/lib/theme/theme-context'

const STORAGE_KEY = 'tm-theme'

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  } catch {
    return 'system'
  }
  return 'system'
}

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const media = matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      applyTheme('system')
    }
    media.addEventListener('change', listener)
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      return
    }
  }, [])

  const value = useMemo(() => ({ setTheme, theme }), [setTheme, theme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}
