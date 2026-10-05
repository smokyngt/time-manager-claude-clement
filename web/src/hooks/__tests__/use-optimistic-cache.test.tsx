import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { queryClient } from '@/config/query'
import { QueryKeys } from '@/config/query-keys'
import { useOptimisticCache } from '@/hooks/use-optimistic-cache'
import { TestQuery } from '@/test-support/test-query'

type Item = { id: string; name: string }

const page = (): { items: Item[]; total: number } => ({
  items: [
    { id: '1', name: 'a' },
    { id: '2', name: 'b' },
    { id: '3', name: 'c' },
  ],
  total: 3,
})

describe('useOptimisticCache', () => {
  beforeEach(() => {
    TestQuery.reset()
    queryClient.setQueryData(QueryKeys.teams({ q: '' }), page())
    queryClient.setQueryData(QueryKeys.teams({ q: 'x' }), page())
    queryClient.setQueryData(QueryKeys.team('1'), { id: '1' })
  })

  function setup() {
    return renderHook(() => useOptimisticCache<Item>(QueryKeys.teams()), {
      wrapper: TestQuery.wrapper(),
    }).result
  }

  it('removes items from every list and adjusts the total', async () => {
    const cache = setup()
    await act(async () => {
      await cache.current.remove(['1', '3'])
    })
    const data = queryClient.getQueryData<{ items: Item[]; total: number }>(
      QueryKeys.teams({ q: '' }),
    )
    expect(data?.items.map((item) => item.id)).toEqual(['2'])
    expect(data?.total).toBe(1)
    expect(
      queryClient.getQueryData<{ items: Item[] }>(QueryKeys.teams({ q: 'x' }))?.items,
    ).toHaveLength(1)
  })

  it('leaves detail queries untouched', async () => {
    const cache = setup()
    await act(async () => {
      await cache.current.remove(['1'])
    })
    expect(queryClient.getQueryData(QueryKeys.team('1'))).toEqual({ id: '1' })
  })

  it('restores the snapshot', async () => {
    const cache = setup()
    let snapshot: Awaited<ReturnType<typeof cache.current.remove>> = []
    await act(async () => {
      snapshot = await cache.current.remove(['1', '2'])
    })
    act(() => {
      cache.current.restore(snapshot)
    })
    expect(queryClient.getQueryData(QueryKeys.teams({ q: '' }))).toEqual(page())
  })

  it('patches items', async () => {
    const cache = setup()
    await act(async () => {
      await cache.current.patch(['2'], { name: 'z' })
    })
    const data = queryClient.getQueryData<{ items: Item[] }>(QueryKeys.teams({ q: '' }))
    expect(data?.items.map((item) => item.name)).toEqual(['a', 'z', 'c'])
  })

  it('invalidates the lists', async () => {
    const cache = setup()
    await act(async () => {
      await cache.current.invalidate()
    })
    expect(queryClient.getQueryState(QueryKeys.teams({ q: '' }))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(QueryKeys.team('1'))?.isInvalidated).toBe(false)
  })
})
