import type { ViewMode } from '@/stores/preferences'

import { usePreferencesStore } from '@/stores/preferences'

export function useViewMode(key: string, fallback: ViewMode = 'grid') {
  const viewMode = usePreferencesStore((state) => state.viewModes[key] ?? fallback)
  const setStoredMode = usePreferencesStore((state) => state.setViewMode)

  return {
    setViewMode: (mode: ViewMode) => {
      setStoredMode(key, mode)
    },
    viewMode,
  }
}
