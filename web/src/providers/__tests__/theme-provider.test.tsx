import type { ReactNode } from 'react'

import { act, render, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/providers/theme-provider'
import { useTheme } from '@/providers/use-theme'
import { usePreferencesStore } from '@/stores/preferences'

function mockMedia(matches: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
        listeners.add(listener),
      matches,
      removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
        listeners.delete(listener),
    })),
  )
  return (next: boolean) => {
    listeners.forEach((listener) => {
      listener({ matches: next })
    })
  }
}

const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>

describe('ThemeProvider', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ theme: 'system' })
    document.documentElement.classList.remove('dark')
    vi.unstubAllGlobals()
  })

  it('applies the dark class for the dark theme', () => {
    mockMedia(false)
    usePreferencesStore.setState({ theme: 'dark' })
    render(<ThemeProvider>x</ThemeProvider>)
    expect(document.documentElement).toHaveClass('dark')
  })

  it('follows the system preference and its changes', () => {
    const change = mockMedia(true)
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    act(() => {
      change(false)
    })
    expect(result.current.resolved).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('persists the chosen theme in the preferences store', () => {
    mockMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => {
      result.current.setTheme('dark')
    })
    expect(usePreferencesStore.getState().theme).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('throws outside the provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within ThemeProvider')
    error.mockRestore()
  })
})
