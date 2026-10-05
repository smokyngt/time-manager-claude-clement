import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'

import { useCursorPagination } from '@/hooks/use-cursor-pagination'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useListPagination } from '@/hooks/use-list-pagination'
import { useMultiParams } from '@/hooks/use-multi-params'
import { useMultiSelect } from '@/hooks/use-multi-select'
import { useViewMode } from '@/hooks/use-view-mode'
import { usePreferencesStore } from '@/stores/preferences'
import { TestClock } from '@/test-support/test-clock'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    TestClock.install()
  })
  afterEach(() => {
    TestClock.restore()
  })

  it('delays updates', async () => {
    const { rerender, result } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'ab' })
    expect(result.current).toBe('a')
    await act(async () => {
      await TestClock.advance(299)
    })
    expect(result.current).toBe('a')
    await act(async () => {
      await TestClock.advance(1)
    })
    expect(result.current).toBe('ab')
  })

  it('restarts the delay on every change', async () => {
    const { rerender, result } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'b' })
    await act(async () => {
      await TestClock.advance(200)
    })
    rerender({ value: 'c' })
    await act(async () => {
      await TestClock.advance(200)
    })
    expect(result.current).toBe('a')
    await act(async () => {
      await TestClock.advance(100)
    })
    expect(result.current).toBe('c')
  })
})

describe('useDocumentTitle', () => {
  it('sets and restores the title', () => {
    document.title = 'before'
    const { rerender, unmount } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Teams' },
    })
    expect(document.title).toBe('Teams · Time Manager')
    rerender({ title: 'Users' })
    expect(document.title).toBe('Users · Time Manager')
    unmount()
    expect(document.title).toBe('before')
  })
})

describe('useMultiSelect', () => {
  it('toggles, selects all, prunes and clears', () => {
    const { result } = renderHook(() => useMultiSelect())
    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
    })
    expect(result.current.count).toBe(2)
    expect(result.current.isSelected('a')).toBe(true)
    act(() => {
      result.current.toggle('a')
    })
    expect(result.current.ids).toEqual(['b'])
    act(() => {
      result.current.selectAll(['a', 'b', 'c'])
    })
    expect(result.current.count).toBe(3)
    act(() => {
      result.current.prune(['a', 'c'])
    })
    expect(result.current.ids).toEqual(['a', 'c'])
    act(() => {
      result.current.clear()
    })
    expect(result.current.count).toBe(0)
  })
})

describe('useListPagination', () => {
  it('computes pages and skip', () => {
    const { result } = renderHook(() => useListPagination(60, 25))
    expect(result.current).toMatchObject({
      hasNext: true,
      hasPrevious: false,
      page: 1,
      pages: 3,
      skip: 0,
    })
    act(() => {
      result.current.next()
    })
    expect(result.current).toMatchObject({ hasPrevious: true, page: 2, skip: 25 })
    act(() => {
      result.current.setPage(99)
    })
    expect(result.current.page).toBe(3)
    expect(result.current.hasNext).toBe(false)
    act(() => {
      result.current.previous()
    })
    expect(result.current.page).toBe(2)
    act(() => {
      result.current.reset()
    })
    expect(result.current.page).toBe(1)
  })

  it('clamps the page when the total shrinks', () => {
    const { rerender, result } = renderHook(({ total }) => useListPagination(total, 10), {
      initialProps: { total: 50 },
    })
    act(() => {
      result.current.setPage(5)
    })
    rerender({ total: 12 })
    expect(result.current.page).toBe(2)
  })
})

describe('useCursorPagination', () => {
  it('walks forward and back through cursors', () => {
    const { result } = renderHook(() => useCursorPagination())
    expect(result.current).toMatchObject({ cursor: undefined, hasPrevious: false, page: 1 })
    act(() => {
      result.current.next('c1')
    })
    act(() => {
      result.current.next('c2')
    })
    expect(result.current).toMatchObject({ cursor: 'c2', hasPrevious: true, page: 3 })
    act(() => {
      result.current.previous()
    })
    expect(result.current.cursor).toBe('c1')
    act(() => {
      result.current.next(null)
    })
    expect(result.current.cursor).toBe('c1')
    act(() => {
      result.current.reset()
    })
    expect(result.current).toMatchObject({ cursor: undefined, page: 1 })
  })
})

describe('useViewMode', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ viewModes: {} })
  })

  it('defaults, persists per key and updates', () => {
    const { result } = renderHook(() => useViewMode('teams'))
    expect(result.current.viewMode).toBe('grid')
    act(() => {
      result.current.setViewMode('list')
    })
    expect(result.current.viewMode).toBe('list')
    expect(usePreferencesStore.getState().viewModes).toEqual({ teams: 'list' })
    expect(renderHook(() => useViewMode('users', 'list')).result.current.viewMode).toBe('list')
  })
})

describe('useMultiParams', () => {
  const defaults = { archived: false, page: 1, q: '' }

  function setup(entry = '/') {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    )
    return renderHook(() => useMultiParams(defaults), { wrapper })
  }

  it('reads typed values with defaults', () => {
    const { result } = setup('/?q=abc&page=3&archived=true')
    expect(result.current.values).toEqual({ archived: true, page: 3, q: 'abc' })
    expect(setup('/?page=nan').result.current.values.page).toBe(1)
    expect(setup().result.current.values).toEqual(defaults)
  })

  it('writes values and drops defaults from the url', () => {
    const { result } = setup()
    act(() => {
      result.current.set({ page: 2, q: 'x' })
    })
    expect(result.current.values).toEqual({ archived: false, page: 2, q: 'x' })
    act(() => {
      result.current.set({ page: 1 })
    })
    expect(result.current.values.page).toBe(1)
    act(() => {
      result.current.reset()
    })
    expect(result.current.values).toEqual(defaults)
  })
})
