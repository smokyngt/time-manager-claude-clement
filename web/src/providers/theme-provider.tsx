import type { ReactNode } from 'react'

import { useEffect, useMemo, useState } from 'react'

import { ThemeContext } from '@/providers/use-theme'
import { usePreferencesStore } from '@/stores/preferences'

const QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark() {
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = usePreferencesStore((state) => state.theme)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    if (typeof matchMedia !== 'function') {
      return
    }
    const media = matchMedia(QUERY)
    const listener = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches)
    }
    media.addEventListener('change', listener)
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [])

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
  }, [resolved])

  const value = useMemo(() => ({ resolved, setTheme, theme }), [resolved, setTheme, theme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}
