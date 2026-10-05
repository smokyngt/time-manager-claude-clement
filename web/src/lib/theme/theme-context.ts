import { createContext } from 'react'

export interface ThemeContextValue {
  setTheme: (theme: Theme) => void
  theme: Theme
}

export type Theme = 'dark' | 'light' | 'system'

export const ThemeContext = createContext<null | ThemeContextValue>(null)
