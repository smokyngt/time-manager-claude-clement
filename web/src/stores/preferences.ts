import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Language } from '@/lib/i18n'

export type Theme = 'dark' | 'light' | 'system'

export type ViewMode = 'grid' | 'list'

export type PreferencesState = {
  collapsedSidebar: boolean
  language: Language | null
  setCollapsedSidebar: (collapsed: boolean) => void
  setLanguage: (language: Language) => void
  setTheme: (theme: Theme) => void
  setViewMode: (key: string, mode: ViewMode) => void
  theme: Theme
  viewModes: Record<string, ViewMode>
}

export const PREFERENCES_STORAGE_KEY = 'tm-preferences'

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      collapsedSidebar: false,
      language: null,
      setCollapsedSidebar: (collapsed) => {
        set({ collapsedSidebar: collapsed })
      },
      setLanguage: (language) => {
        set({ language })
      },
      setTheme: (theme) => {
        set({ theme })
      },
      setViewMode: (key, mode) => {
        set((state) => ({ viewModes: { ...state.viewModes, [key]: mode } }))
      },
      theme: 'system',
      viewModes: {},
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      partialize: (state) => ({
        collapsedSidebar: state.collapsedSidebar,
        language: state.language,
        theme: state.theme,
        viewModes: state.viewModes,
      }),
    },
  ),
)
