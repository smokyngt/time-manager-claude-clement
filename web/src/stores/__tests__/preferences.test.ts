import { beforeEach, describe, expect, it } from 'vitest'

import { PREFERENCES_STORAGE_KEY, usePreferencesStore } from '@/stores/preferences'

describe('usePreferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      collapsedSidebar: false,
      language: null,
      theme: 'system',
      viewModes: {},
    })
    localStorage.clear()
  })

  it('persists theme, language, sidebar and view modes', () => {
    const state = usePreferencesStore.getState()
    state.setTheme('dark')
    state.setLanguage('fr')
    state.setCollapsedSidebar(true)
    state.setViewMode('teams', 'list')
    const stored = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}') as {
      state: Record<string, unknown>
    }
    expect(stored.state).toEqual({
      collapsedSidebar: true,
      language: 'fr',
      theme: 'dark',
      viewModes: { teams: 'list' },
    })
  })

  it('does not persist actions', () => {
    usePreferencesStore.getState().setTheme('light')
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).not.toContain('setTheme')
  })

  it('keeps view modes per key', () => {
    usePreferencesStore.getState().setViewMode('teams', 'list')
    usePreferencesStore.getState().setViewMode('users', 'grid')
    expect(usePreferencesStore.getState().viewModes).toEqual({ teams: 'list', users: 'grid' })
  })
})
