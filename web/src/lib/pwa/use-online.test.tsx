import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useOnline } from './use-online'

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

describe('useOnline', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reflects initial state and updates on events', () => {
    setOnline(true)
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)
    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})
