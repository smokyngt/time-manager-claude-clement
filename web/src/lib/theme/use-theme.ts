import { use } from 'react'

import { ThemeContext } from '@/lib/theme/theme-context'

export function useTheme() {
  const context = use(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
