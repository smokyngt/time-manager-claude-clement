import { createContext, use } from 'react'

import type { Theme } from '@/stores/preferences'

export type ThemeContextValue = {
  resolved: 'dark' | 'light'
  setTheme: (theme: Theme) => void
  theme: Theme
}

export const ThemeContext = createContext<null | ThemeContextValue>(null)

export function useTheme() {
  const context = use(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
